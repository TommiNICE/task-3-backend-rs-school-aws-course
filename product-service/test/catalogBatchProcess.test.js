const { handler } = require('../lambda/catalogBatchProcess/index');
const { DynamoDBDocumentClient, TransactWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

// Mock the DynamoDB client
jest.mock('@aws-sdk/client-dynamodb', () => {
  return {
    DynamoDBClient: jest.fn(() => ({
      send: jest.fn()
    }))
  };
});

// Mock the DynamoDB Document client
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnThis(),
    send: jest.fn()
  },
  TransactWriteCommand: jest.fn()
}));

// Mock SNS client
jest.mock('@aws-sdk/client-sns', () => {
  const mockSend = jest.fn();
  return {
    SNSClient: jest.fn(() => ({
      send: mockSend
    })),
    PublishCommand: jest.fn()
  };
});

// Mock AWS credentials provider
jest.mock('@aws-sdk/credential-provider-node', () => ({
  defaultProvider: jest.fn().mockImplementation(() => Promise.resolve({
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
    sessionToken: 'test-session-token'
  }))
}));

describe('catalogBatchProcess Lambda', () => {
  const mockEvent = {
    Records: [
      {
        body: JSON.stringify({
          title: 'Test Product',
          description: 'Test Description',
          price: 100,
          count: 10
        })
      }
    ]
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Set environment variables
    process.env.AWS_REGION = 'us-east-1';
    process.env.PRODUCTS_TABLE = 'products';
    process.env.STOCKS_TABLE = 'stocks';
    process.env.SNS_TOPIC_ARN = 'test-topic-arn';
    // Set AWS_LAMBDA_FUNCTION_NAME to simulate Lambda environment
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';

    // Mock successful DynamoDB transaction
    DynamoDBDocumentClient.send.mockResolvedValue({});
    
    // Mock successful SNS publish
    const mockSNSInstance = new SNSClient();
    mockSNSInstance.send.mockResolvedValue({});
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
  });

  test('successfully processes valid product data', async () => {
    const response = await handler(mockEvent);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe('Successfully processed all records');

    expect(TransactWriteCommand).toHaveBeenCalled();
    const transactCommand = TransactWriteCommand.mock.calls[0][0];
    
    expect(transactCommand.TransactItems[0].Put.TableName).toBe('products');
    expect(transactCommand.TransactItems[0].Put.Item).toMatchObject({
      title: 'Test Product',
      description: 'Test Description',
      price: 100
    });
    
    expect(transactCommand.TransactItems[1].Put.TableName).toBe('stocks');
    expect(transactCommand.TransactItems[1].Put.Item).toMatchObject({
      count: 10
    });

    expect(PublishCommand).toHaveBeenCalled();
    const publishCommand = PublishCommand.mock.calls[0][0];
    expect(publishCommand.TopicArn).toBe('test-topic-arn');
  });

  test('skips processing when required fields are missing', async () => {
    const invalidEvent = {
      Records: [
        {
          body: JSON.stringify({
            title: 'Test Product',
            // missing price and count
          })
        }
      ]
    };

    const response = await handler(invalidEvent);

    expect(response.statusCode).toBe(200);
    expect(TransactWriteCommand).not.toHaveBeenCalled();
    expect(PublishCommand).not.toHaveBeenCalled();
  });

  test('skips processing when price or count are invalid', async () => {
    const invalidEvent = {
      Records: [
        {
          body: JSON.stringify({
            title: 'Test Product',
            description: 'Test Description',
            price: 'invalid',
            count: 'invalid'
          })
        }
      ]
    };

    const response = await handler(invalidEvent);

    expect(response.statusCode).toBe(200);
    expect(TransactWriteCommand).not.toHaveBeenCalled();
    expect(PublishCommand).not.toHaveBeenCalled();
  });

  test('handles DynamoDB errors properly', async () => {
    DynamoDBDocumentClient.send.mockRejectedValue(new Error('DynamoDB error'));

    await expect(handler(mockEvent)).rejects.toThrow('DynamoDB error');
    expect(PublishCommand).not.toHaveBeenCalled();
  });

  test('handles SNS errors properly', async () => {
    const mockSNSInstance = new SNSClient();
    mockSNSInstance.send.mockRejectedValue(new Error('SNS error'));

    await expect(handler(mockEvent)).rejects.toThrow('SNS error');
  });
});
