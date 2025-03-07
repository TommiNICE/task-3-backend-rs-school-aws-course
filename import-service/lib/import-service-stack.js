const { Stack, Duration } = require('aws-cdk-lib');
const lambda = require('aws-cdk-lib/aws-lambda');
const apigateway = require('aws-cdk-lib/aws-apigateway');
const iam = require('aws-cdk-lib/aws-iam');
const s3 = require('aws-cdk-lib/aws-s3');
const s3n = require('aws-cdk-lib/aws-s3-notifications');

require('dotenv').config();

class ImportServiceStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // CloudWatch Logs Role
    const apiGatewayLogsRole = new iam.Role(this, 'ApiGatewayLogsRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonAPIGatewayPushToCloudWatchLogs'
        )
      ]
    });

    const apiGatewayAccountSettings = new apigateway.CfnAccount(this, 'ApiGatewayAccount', {
      cloudWatchRoleArn: apiGatewayLogsRole.roleArn
    });

    // Reference S3 bucket
    const bucket = s3.Bucket.fromBucketName(
      this,
      'ImportBucket',
      process.env.BUCKET
    );

    // Create Lambda
    const importProductsFile = new lambda.Function(this, 'ImportProductsFileHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/importProductsFile'),
      environment: {
        BUCKET_NAME: process.env.BUCKET
      },
      timeout: Duration.seconds(30),
      memorySize: 256
    });

    // S3 permissions
    importProductsFile.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:PutObject',
        's3:GetObject',
        's3:ListBucket'
      ],
      resources: [
        bucket.bucketArn,
        `${bucket.bucketArn}/*`
      ]
    }));

    // API Gateway
    const api = new apigateway.RestApi(this, 'ImportApi', {
      restApiName: 'Import Service',
      deployOptions: {
        stageName: 'prod',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true
      },
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'],
        allowMethods: ['GET', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key']
      }
    });

    api.node.addDependency(apiGatewayAccountSettings);

    // Add /import endpoint
    const importResource = api.root.addResource('import');

    // Add GET method
    importResource.addMethod('GET',
      new apigateway.LambdaIntegration(importProductsFile, {
        proxy: true,
        integrationResponses: [{
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'"
          }
        }]
      }), {
      requestParameters: {
        'method.request.querystring.name': true
      },
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true
        }
      }]
    }
    );

    // Create the importFileParser Lambda
    const importFileParser = new lambda.Function(this, 'ImportFileParser', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/importFileParser',),
      timeout: Duration.seconds(30),
      memorySize: 256,
      environment: {
        BUCKET_NAME: process.env.BUCKET
      }
    });

    // Add S3 permissions for importFileParser
    importFileParser.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:ListBucket'
      ],
      resources: [
        `arn:aws:s3:::${process.env.BUCKET}`,
        `arn:aws:s3:::${process.env.BUCKET}/*`
      ]
    }));

    // Add S3 notification for the importFileParser Lambda
    const notification = new s3n.LambdaDestination(importFileParser);

    // Add the notification configuration to the bucket
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      notification,
      {
        prefix: 'uploaded/', // Only trigger for objects in the uploaded/ prefix
        suffix: '.csv' // Only trigger for .csv files
      }
    );

  }
}

module.exports = { ImportServiceStack };
