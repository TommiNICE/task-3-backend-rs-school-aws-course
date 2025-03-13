const { DynamoDB } = require('aws-sdk');
const dynamodb = new DynamoDB.DocumentClient();

exports.catalogBatchProcess = async (event) => {
  try {
    for (const record of event.Records) {
      const item = JSON.parse(record.body);
      
      // Create product entry
      const productParams = {
        TableName: 'products',
        Item: {
          id: item.id,
          title: item.title,
          description: item.description,
          price: item.price
        }
      };

      // Create stock entry
      const stockParams = {
        TableName: 'stocks',
        Item: {
          product_id: item.id,
          count: item.count
        }
      };

      // Save to DynamoDB
      await dynamodb.put(productParams).promise();
      await dynamodb.put(stockParams).promise();
    }

    return {
      statusCode: 200,
      body: 'Successfully processed messages'
    };
  } catch (error) {
    console.error('Error processing messages:', error);
    throw error;
  }
};
