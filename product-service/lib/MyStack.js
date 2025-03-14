const { Stack, Duration } = require('aws-cdk-lib');
const path = require('path'); 
const lambda = require('aws-cdk-lib/aws-lambda');
const { NodejsFunction } = require('aws-cdk-lib/aws-lambda-nodejs');
const apigateway = require('aws-cdk-lib/aws-apigateway');
const iam = require('aws-cdk-lib/aws-iam');
const sqs = require('aws-cdk-lib/aws-sqs');
const sns = require('aws-cdk-lib/aws-sns');
const snsSubs = require('aws-cdk-lib/aws-sns-subscriptions');
const { SqsEventSource } = require('aws-cdk-lib/aws-lambda-event-sources');

class MyStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Create SNS Topic
    const createProductTopic = new sns.Topic(this, 'CreateProductTopic', {
      topicName: 'create-product-topic'
    });

    // Add email subscription
    createProductTopic.addSubscription(
      new snsSubs.EmailSubscription('tomislavvarga37@gmail.com')
    );

    // Create SQS Queue
    const catalogItemsQueue = new sqs.Queue(this, 'CatalogItemsQueue', {
      queueName: 'catalogItemsQueue',
      visibilityTimeout: Duration.seconds(30),
    });
    
    // Create catalogBatchProcess Lambda
    const catalogBatchProcess = new lambda.Function(this, 'CatalogBatchProcess', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/catalogBatchProcess'),
      timeout: Duration.seconds(30),
      environment: {
        PRODUCTS_TABLE: 'products',
        STOCKS_TABLE: 'stocks',
        SNS_TOPIC_ARN: createProductTopic.topicArn
      }
    }); 

    // Add SQS trigger to Lambda
    catalogBatchProcess.addEventSource(new SqsEventSource(catalogItemsQueue, {
      batchSize: 5
    }));

    // Add permissions for the Lambda to access SQS and DynamoDB
    catalogBatchProcess.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'sqs:ReceiveMessage',
        'sqs:DeleteMessage',
        'sqs:GetQueueAttributes'
      ],
      resources: [catalogItemsQueue.queueArn]
    }));

    // Add DynamoDB permissions
    catalogBatchProcess.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:PutItem',
        'dynamodb:TransactWriteItems'
      ],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/products`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/stocks`
      ]
    }));

    // Add SNS publish permissions
    catalogBatchProcess.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sns:Publish'],
      resources: [createProductTopic.topicArn]
    }));

    // Create Lambda function for getting products list
    const getProductsList = new NodejsFunction(this, 'GetProductsList', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/getProductsList/index.js'),
      handler: 'getProductsList',
      bundling: {
        externalModules: [], // Bundle all modules
      },
    });

    // Add DynamoDB permissions for getProductsList
    getProductsList.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:Scan'
      ],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/products`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/stocks`
      ]
    }));

    // Create Lambda function for getting product by ID
    const getProductByIdFunction = new NodejsFunction(this, 'GetProductByIdFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/getProductById/index.js'),
      handler: 'getProductById',
      bundling: {
        externalModules: [], // Bundle all modules
      },
    });

    // Add DynamoDB permissions for getProductById
    getProductByIdFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:GetItem',
        'dynamodb:Query'
      ],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/products`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/stocks`
      ]
    }));

    // Create Lambda function for creating products
    const createProductFunction = new NodejsFunction(this, 'CreateProductFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/createProduct/index.js'),
      handler: 'createProduct',
      bundling: {
        externalModules: [], // Bundle all modules
      },
    });

    // Add DynamoDB permissions for createProduct
    createProductFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:PutItem'
      ],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/products`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/stocks`
      ]
    }));

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'ProductsApi', {
      restApiName: 'Products Service',
      description: 'API for managing products',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS
      }
    });

    // Add resources and methods
    const productsResource = api.root.addResource('products');
    
    // GET /products - List all products
    productsResource.addMethod('GET', new apigateway.LambdaIntegration(getProductsList));
    
    // POST /products - Create a new product
    productsResource.addMethod('POST', new apigateway.LambdaIntegration(createProductFunction));

    // Add product by ID endpoint
    const productByIdResource = productsResource.addResource('{id}');
    productByIdResource.addMethod('GET', new apigateway.LambdaIntegration(getProductByIdFunction));
  }
}

module.exports = { MyStack }
