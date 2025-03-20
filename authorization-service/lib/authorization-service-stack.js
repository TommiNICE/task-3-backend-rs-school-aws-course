const { Stack } = require('aws-cdk-lib');
const lambda = require('aws-cdk-lib/aws-lambda');
const iam = require('aws-cdk-lib/aws-iam');
const path = require('path');
require('dotenv').config();

class AuthorizationServiceStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Validate environment variables
    if (!process.env.TommiNICE) {
      throw new Error('Required environment variables are not set');
    }

    // Create Lambda function
    const basicAuthorizer = new lambda.Function(this, 'BasicAuthorizerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/basicAuthorizer')),
      environment: {
        // Use environment variable from .env
        TommiNICE: process.env.TommiNICE
      }
    });
  }
}

module.exports = { AuthorizationServiceStack }
