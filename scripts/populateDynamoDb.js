const { 
  DynamoDBClient, 
  ListTablesCommand, 
  CreateTableCommand 
} = require("@aws-sdk/client-dynamodb");
const { 
  DynamoDBDocumentClient, 
  PutCommand
} = require("@aws-sdk/lib-dynamodb");
const { fromSSO } = require("@aws-sdk/credential-provider-sso");
const { v4: uuidv4 } = require("uuid");

// Initialize the DynamoDB client
const client = new DynamoDBClient({ 
  region: "eu-north-1",
  credentials: fromSSO({ profile: "dev_tom" }) // Use your SSO profile name
});
const docClient = DynamoDBDocumentClient.from(client);

// Generate UUIDs for products
const productIds = [
  uuidv4(),
  uuidv4(),
  uuidv4(),
  uuidv4(),
  uuidv4()
];

// Mock data for products with UUID IDs
const productsMockData = [
  {
    id: productIds[0],
    title: "Gaming Laptop",
    description: "High-performance gaming laptop with RTX 4080",
    price: 1999.99
  },
  {
    id: productIds[1],
    title: "Wireless Headphones",
    description: "Noise-cancelling Bluetooth headphones",
    price: 249.99
  },
  {
    id: productIds[2],
    title: "Mechanical Keyboard",
    description: "RGB mechanical keyboard with Cherry MX switches",
    price: 159.99
  },
  {
    id: productIds[3],
    title: "Ultra-wide Monitor",
    description: "34-inch curved gaming monitor, 144Hz",
    price: 499.99
  },
  {
    id: productIds[4],
    title: "Wireless Mouse",
    description: "Ergonomic wireless gaming mouse with adjustable DPI",
    price: 89.99
  }
];

// Mock data for stocks (referencing products by UUID)
const stocksMockData = [
  {
    productId: productIds[0],
    stock: 15
  },
  {
    productId: productIds[1],
    stock: 42
  },
  {
    productId: productIds[2],
    stock: 30
  },
  {
    productId: productIds[3],
    stock: 7
  },
  {
    productId: productIds[4],
    stock: 22
  }
];

// Function to check if tables exist
async function checkIfTablesExist() {
  try {
    const { TableNames } = await client.send(new ListTablesCommand({}));
    return {
      productsExists: TableNames.includes("products"),
      stocksExists: TableNames.includes("stocks")
    };
  } catch (error) {
    console.error("Error checking tables:", error);
    throw error;
  }
}

// Function to create tables if they don't exist
async function createTablesIfNotExist() {
  const { productsExists, stocksExists } = await checkIfTablesExist();
  
  // Create products table if it doesn't exist
  if (!productsExists) {
    const productsTableParams = {
      TableName: "products",
      KeySchema: [
        { AttributeName: "id", KeyType: "HASH" } // Partition key
      ],
      AttributeDefinitions: [
        { AttributeName: "id", AttributeType: "S" }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    };
    
    try {
      await client.send(new CreateTableCommand(productsTableParams));
      console.log("Products table created successfully");
    } catch (error) {
      console.error("Error creating products table:", error);
    }
  } else {
    console.log("Products table already exists");
  }
  
  // Create stocks table if it doesn't exist
  if (!stocksExists) {
    const stocksTableParams = {
      TableName: "stocks",
      KeySchema: [
        { AttributeName: "productId", KeyType: "HASH" } // Partition key
      ],
      AttributeDefinitions: [
        { AttributeName: "productId", AttributeType: "S" }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    };
    
    try {
      await client.send(new CreateTableCommand(stocksTableParams));
      console.log("Stocks table created successfully");
    } catch (error) {
      console.error("Error creating stocks table:", error);
    }
  } else {
    console.log("Stocks table already exists");
  }
}

// Function to populate tables with mock data
async function populateTables() {
  // Populate products table
  console.log("Populating products table...");
  for (const product of productsMockData) {
    const params = {
      TableName: "products",
      Item: product
    };
    
    try {
      await docClient.send(new PutCommand(params));
      console.log(`Added product: ${product.id} - ${product.title}`);
    } catch (error) {
      console.error(`Error adding product ${product.id}:`, error);
    }
  }
  
  // Populate stocks table
  console.log("Populating stocks table...");
  for (const stockItem of stocksMockData) {
    const params = {
      TableName: "stocks",
      Item: stockItem
    };
    
    try {
      await docClient.send(new PutCommand(params));
      console.log(`Added stock for product: ${stockItem.productId} - ${stockItem.stock} units`);
    } catch (error) {
      console.error(`Error adding stock for product ${stockItem.productId}:`, error);
    }
  }
}

// Main function to run the script
async function main() {
  try {
    await createTablesIfNotExist();
    await populateTables();
    console.log("Tables populated successfully!");
  } catch (error) {
    console.error("Error in main function:", error);
  }
}

// Run the script
main();
