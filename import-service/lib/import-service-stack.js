const { Stack, Duration } = require('aws-cdk-lib');
const lambda = require('aws-cdk-lib/aws-lambda');
const apigateway = require('aws-cdk-lib/aws-apigateway');
const iam = require('aws-cdk-lib/aws-iam');
const s3 = require('aws-cdk-lib/aws-s3');
const s3n = require('aws-cdk-lib/aws-s3-notifications');
const sqs = require('aws-cdk-lib/aws-sqs');

require('dotenv').config();

class ImportServiceStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    if (!process.env.CATALOG_ITEMS_QUEUE_ARN) {
      throw new Error('CATALOG_ITEMS_QUEUE_ARN environment variable is required');
    }

    // Reference existing SQS queue using environment variable
    const catalogItemsQueue = sqs.Queue.fromQueueArn(
      this,
      'CatalogItemsQueue',
      process.env.CATALOG_ITEMS_QUEUE_ARN
    );

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

    // Reference the existing basicAuthorizer Lambda function
    const basicAuthorizer = lambda.Function.fromFunctionArn(
      this,
      'BasicAuthorizer',
      process.env.AUTHORIZER_LAMBDA_ARN
    );

    // Create the Lambda authorizer
    const authorizer = new apigateway.RequestAuthorizer(this, 'ImportApiAuthorizer', {
      handler: basicAuthorizer,
      identitySources: [apigateway.IdentitySource.header('Authorization')],
      resultsCacheTtl: Duration.seconds(0),
      authorizerResultTtl: Duration.seconds(0)
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
        stageName: 'dev',
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

    // Add method with proper response configuration
    importResource.addMethod('GET',
      new apigateway.LambdaIntegration(importProductsFile), {
      authorizer: authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true
          }
        },
        {
          statusCode: '401',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true
          }
        },
        {
          statusCode: '403',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true
          }
        }
      ]
    }
    );

    const importFileParser = new lambda.Function(this, 'ImportFileParser', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/importFileParser'),
      environment: {
        QUEUE_URL: catalogItemsQueue.queueUrl
      }
    });

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

    importFileParser.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['sqs:SendMessage', 'sqs:SendMessageBatch'],
      resources: [catalogItemsQueue.queueArn]
    }));

    const notification = new s3n.LambdaDestination(importFileParser);

    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      notification,
      {
        prefix: 'uploaded/',
        suffix: '.csv'
      }
    );
  }
}

module.exports = { ImportServiceStack };
