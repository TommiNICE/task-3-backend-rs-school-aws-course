const { Stack } = require('aws-cdk-lib');
const lambda = require('aws-cdk-lib/aws-lambda');
const apigateway = require('aws-cdk-lib/aws-apigateway');
const iam = require('aws-cdk-lib/aws-iam');

class RsAwsDeveloperBackendStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Create Lambda function for getting products
    const getProductsFunction = new lambda.Function(this, 'GetProductsFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.getProductsList',
      code: lambda.Code.fromAsset('lambda'),
    });

    // Add DynamoDB permissions
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
    const getProductByIdFunction = new lambda.Function(this, 'GetProductByIdFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.getProductById',
      code: lambda.Code.fromAsset('lambda'),
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

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'ProductsApi', {
      restApiName: 'Products Service',
      description: 'API for products service'
    });

    // Add resources and methods
    const productsResource = api.root.addResource('products');
    productsResource.addMethod('GET', new apigateway.LambdaIntegration(getProductsFunction));

    // Add product by ID endpoint
    const productByIdResource = productsResource.addResource('{id}');
    productByIdResource.addMethod('GET', new apigateway.LambdaIntegration(getProductByIdFunction));
  }
}

module.exports = { RsAwsDeveloperBackendStack }

