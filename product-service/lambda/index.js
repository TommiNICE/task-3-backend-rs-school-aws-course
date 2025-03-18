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

exports.createProduct = async (event) => {
  try {
    // Parse the request body
    const requestBody = JSON.parse(event.body);
    
    // Validate required fields exist
    if (!requestBody.title || !requestBody.description || requestBody.price === undefined) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({ 
          message: 'Missing required fields. Please provide title, description, and price.' 
        })
      };
    }
    
    // Validate field types
    const validationErrors = [];
    
    // Validate title is a string
    if (typeof requestBody.title !== 'string') {
      validationErrors.push('Title must be a string');
    }
    
    // Validate description is a string
    if (typeof requestBody.description !== 'string') {
      validationErrors.push('Description must be a string');
    }
    
    // Validate price is a number
    if (typeof requestBody.price !== 'number' || isNaN(requestBody.price)) {
      validationErrors.push('Price must be a number');
    }
    
    // Validate count is a number if provided
    if (requestBody.count !== undefined && (typeof requestBody.count !== 'number' || isNaN(requestBody.count) || !Number.isInteger(requestBody.count))) {
      validationErrors.push('Count must be an integer number');
    }
    
    // Return validation errors if any
    if (validationErrors.length > 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({ 
          message: 'Validation failed',
          errors: validationErrors
        })
      };
    }
    
    // Additional business rules validation
    if (requestBody.price <= 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({ 
          message: 'Price must be greater than zero'
        })
      };
    }
    
    // Generate a unique ID for the product
    const productId = uuidv4();
    
    // Create the product item (without stock information)
    const product = {
      id: productId,
      title: requestBody.title,
      description: requestBody.description,
      price: requestBody.price,
      // Add any other product-specific fields from the request
      ...(requestBody.image && typeof requestBody.image === 'string' && { image: requestBody.image })
    };
    
    // Save the product to the DynamoDB table
    await docClient.send(
      new PutCommand({
        TableName: "products",
        Item: product
      })
    );
    
    // Create a separate stock entry in the stocks table
    const stockCount = requestBody.count !== undefined ? requestBody.count : 0;
    await docClient.send(
      new PutCommand({
        TableName: "stocks",
        Item: {
          productId: productId,
          stock: stockCount
        }
      })
    );
    
    // Return success response with the created product and its stock
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({
        message: 'Product created successfully',
        product: {
          ...product,
          count: stockCount
        }
      })
    };
  } catch (error) {
    console.error('Error creating product:', error);
    
    // Handle JSON parsing errors specifically
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({ 
          message: 'Invalid JSON in request body'
        })
      };
    }
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({ 
        message: 'Error creating product', 
        error: error.message 
      })
    };
  }
};

