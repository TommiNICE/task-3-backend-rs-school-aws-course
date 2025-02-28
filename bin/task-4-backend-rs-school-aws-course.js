const cdk = require('aws-cdk-lib');
const { Stack } = require('aws-cdk-lib');
const { RsAwsDeveloperBackendStack } = require('../lib/stack');

const app = new cdk.App();
new RsAwsDeveloperBackendStack(app, 'stack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});