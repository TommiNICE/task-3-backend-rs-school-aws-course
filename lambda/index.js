const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");

// Initialize the DynamoDB client
const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

exports.getProductsList = async (event) => {
  try {
    // Step 1: Scan the products table to get all products
    const productsResponse = await docClient.send(
      new ScanCommand({
        TableName: "products"
      })
    );
    
    const products = productsResponse.Items || [];
    
    if (products.length === 0) {
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
    const stocksResponse = await docClient.send(
      new ScanCommand({
        TableName: "stocks"
      })
    );
    
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
    
    // Step 2: Get the stock information for this product
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
