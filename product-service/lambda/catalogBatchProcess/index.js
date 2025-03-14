const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, TransactWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const dynamoClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(dynamoClient);

exports.handler = async (event) => {
  try {
    console.log('Received event:', JSON.stringify(event, null, 2));

    for (const record of event.Records) {
      const item = JSON.parse(record.body);
      
      // Generate a new UUID for the product
      const productId = uuidv4();

      // Validate required fields
      if (!item.title || !item.price || !item.count) {
        console.error('Missing required fields:', item);
        continue;
      }

      // Ensure price and count are numbers
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
                productId: productId,  // Changed from product_id to productId
                count: count
              }
            }
          }
        ]
      });

      // Execute transaction
      await docClient.send(transactCommand);
      console.log(`Successfully processed product: ${productId}`);
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
