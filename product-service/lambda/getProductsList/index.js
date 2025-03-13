const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");

// Initialize the DynamoDB client
const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

exports.getProductsList = async (event) => {
  console.log('Event received:', JSON.stringify(event));
  
  try {
    // Step 1: Scan the products table to get all products
    console.log('Scanning products table...');
    const productsResponse = await docClient.send(
      new ScanCommand({
        TableName: "products"
      })
    );
    
    console.log('Products response:', JSON.stringify(productsResponse));
    const products = productsResponse.Items || [];
    
    if (products.length === 0) {
      console.log('No products found');
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify([])
      };
    }
    
    // Step 2: Scan the stocks table to get all stock information
    console.log('Scanning stocks table...');
    const stocksResponse = await docClient.send(
      new ScanCommand({
        TableName: "stocks"
      })
    );
    
    console.log('Stocks response:', JSON.stringify(stocksResponse));
    const stocks = stocksResponse.Items || [];
    
    // Step 3: Create a map of productId to stock for faster lookups
    const stocksMap = {};
    stocks.forEach(stockItem => {
      stocksMap[stockItem.productId] = stockItem.stock;
    });
    
    // Step 4: Join products with their stock information
    const productsWithStock = products.map(product => ({
      ...product,
      count: stocksMap[product.id] || 0 // Default to 0 if no stock information is found
    }));
    
    console.log('Returning products with stock:', JSON.stringify(productsWithStock));
    
    // Return the combined data
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify(productsWithStock)
    };
  } catch (error) {
    console.error('Error:', error);
    
    // Always return a properly formatted response, even in error cases
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({ 
        message: 'Internal server error', 
        error: error.message,
        stack: error.stack
      })
    };
  }
};
