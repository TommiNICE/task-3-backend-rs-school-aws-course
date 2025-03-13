const { Stack } = require('aws-cdk-lib');
const lambda = require('aws-cdk-lib/aws-lambda');
const apigateway = require('aws-cdk-lib/aws-apigateway');
const iam = require('aws-cdk-lib/aws-iam');
const path = require('path');
const { NodejsFunction } = require('aws-cdk-lib/aws-lambda-nodejs');

class MyStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Create Lambda function for getting products using NodejsFunction
    const getProductsFunction = new NodejsFunction(this, 'GetProductsFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/getProductsList/index.js'),
      handler: 'getProductsList',
      bundling: {
        externalModules: [], // Bundle all modules
      },
    });

    // Add DynamoDB permissions for getProducts
    getProductsFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:Scan',
        'dynamodb:GetItem',
        'dynamodb:BatchGetItem'
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
    productsResource.addMethod('GET', new apigateway.LambdaIntegration(getProductsFunction));
    
    // POST /products - Create a new product
    productsResource.addMethod('POST', new apigateway.LambdaIntegration(createProductFunction));

    // Add product by ID endpoint
    const productByIdResource = productsResource.addResource('{id}');
    productByIdResource.addMethod('GET', new apigateway.LambdaIntegration(getProductByIdFunction));
  }
}

module.exports = { MyStack }
