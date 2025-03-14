const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, TransactWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { fromSSO } = require('@aws-sdk/credential-provider-sso');
const { v4: uuidv4 } = require('uuid');

const config = {
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: process.env.AWS_LAMBDA_FUNCTION_NAME ? undefined : fromSSO()
};

const dynamoClient = new DynamoDBClient(config);
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const snsClient = new SNSClient(config);

exports.handler = async (event) => {
  try {
    console.log('Received event:', JSON.stringify(event, null, 2));

    for (const record of event.Records) {
      const item = JSON.parse(record.body);
      
      const productId = uuidv4();

      if (!item.title || !item.price || !item.count) {
        console.error('Missing required fields:', item);
        continue;
      }

      const price = Number(item.price);
      const count = Number(item.count);

      if (isNaN(price) || isNaN(count)) {
        console.error('Invalid price or count value:', item);
        continue;
      }

      // Prepare transaction command
      const transactCommand = new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: process.env.PRODUCTS_TABLE,
              Item: {
                id: productId,
                title: item.title,
                description: item.description || 'No description provided',
                price: price
              }
            }
          },
          {
            Put: {
              TableName: process.env.STOCKS_TABLE,
              Item: {
                productId: productId,
                count: count
              }
            }
          }
        ]
      });

      // Execute transaction
      await docClient.send(transactCommand);
      
      // Publish to SNS
      const publishCommand = new PublishCommand({
        TopicArn: process.env.SNS_TOPIC_ARN,
        Message: JSON.stringify({
          message: 'Product created successfully',
          product: {
            id: productId,
            title: item.title,
            description: item.description || 'No description provided',
            price: price,
            count: count
          }
        }),
        MessageAttributes: {
          price: {
            DataType: 'Number',
            StringValue: price.toString()
          }
        }
      });

      await snsClient.send(publishCommand);
      console.log(`Successfully processed and notified for product: ${productId}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Successfully processed all records'
      })
    };

  } catch (error) {
    console.error('Error processing messages:', error);
    throw error;
  }
};
