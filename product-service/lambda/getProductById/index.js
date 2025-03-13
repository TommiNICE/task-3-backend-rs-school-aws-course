const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");

// Initialize the DynamoDB client
const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);


exports.getProductById = async (event) => {
  try {
    const productId = event.pathParameters.id;

    // Step 1: Get the product from the products table
    const productResponse = await docClient.send(
      new GetCommand({
        TableName: "products",
        Key: {
          id: productId
        }
      })
    );

    const product = productResponse.Item;

    if (!product) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({ message: 'Product not found' })
      };
    }

    // Step 2: Get the stock information for this product from the stocks table
    const stockResponse = await docClient.send(
      new GetCommand({
        TableName: "stocks",
        Key: {
          productId: productId
        }
      })
    );

    const stockItem = stockResponse.Item;

    // Step 3: Combine product with stock information
    const productWithStock = {
      ...product,
      count: stockItem ? stockItem.stock : 0
    };

    // Return the product with stock information
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify(productWithStock)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({ message: 'Internal server error', error: error.message })
    };
  }
};

