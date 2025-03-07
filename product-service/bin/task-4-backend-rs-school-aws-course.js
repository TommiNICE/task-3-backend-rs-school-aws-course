const cdk = require('aws-cdk-lib');
const { Stack } = require('aws-cdk-lib');
const { MyStack } = require('../lib/MyStack');

const app = new cdk.App();
new MyStack(app, 'MyStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});