#!/usr/bin/env node
require('dotenv').config();
const cdk = require('aws-cdk-lib');
const { AuthorizationServiceStack } = require('../lib/authorization-service-stack');

const app = new cdk.App();
new AuthorizationServiceStack(app, 'AuthorizationServiceStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  }
});
