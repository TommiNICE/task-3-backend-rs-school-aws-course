#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
const lambda = require('aws-cdk-lib/aws-lambda');
const apigateway = require('aws-cdk-lib/aws-apigateway');

const products = [
  {
    id: '1',
    title: 'Gaming Laptop',
    description: 'High-performance gaming laptop with RTX 4080',
    price: 1999.99,
    count: 10
  },
  {
    id: '2',
    title: 'Wireless Headphones',
    description: 'Noise-cancelling Bluetooth headphones',
    price: 249.99,
    count: 15
  },
  {
    id: '3',
    title: 'Mechanical Keyboard',
    description: 'RGB mechanical keyboard with Cherry MX switches',
    price: 159.99,
    count: 20
  },
  {
    id: '4',
    title: 'Ultra-wide Monitor',
    description: '34-inch curved gaming monitor, 144Hz',
    price: 499.99,
    count: 5
  }
];

class Task3BackendRsSchoolAwsCourseStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Lambda function
    const getProductsFunction = new lambda.Function(this, 'GetProductsFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.getProductsList',
      code: lambda.Code.fromAsset('lambda'),
      environment: {
        PRODUCTS: JSON.stringify(products) // Pass products as environment variable
      }
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'ProductsApi', {
      restApiName: 'Products Service'
    });

    const productsResource = api.root.addResource('products');
    productsResource.addMethod('GET', new apigateway.LambdaIntegration(getProductsFunction));
  }
}

const app = new cdk.App();
new Task3BackendRsSchoolAwsCourseStack(app, 'Task3BackendRsSchoolAwsCourseStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});

module.exports = { Task3BackendRsSchoolAwsCourseStack }
