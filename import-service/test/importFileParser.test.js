const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { handler: importFileParser } = require('../lambda/importFileParser/index');

// Set AWS region for testing
process.env.AWS_REGION = 'eu-north-1';

// Mock AWS SDK v3
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({
    send: jest.fn()
  })),
  GetObjectCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: jest.fn(() => ({
    send: jest.fn()
  })),
  SendMessageCommand: jest.fn()
}));

describe('importFileParser lambda', () => {
  let s3ClientMock;
  let sqsClientMock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock clients with explicit region
    s3ClientMock = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test'
      }
    });
    
    sqsClientMock = new SQSClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test'
      }
    });

    // Mock the constructor to return our mock instance
    S3Client.mockImplementation(() => s3ClientMock);
    SQSClient.mockImplementation(() => sqsClientMock);
  });

  test('should process CSV file and send messages to SQS', async () => {
    // Mock S3 response
    const mockCsvContent = 'title,description,price,count\n' +
                         'Product1,Description1,10,5\n' +
                         'Product2,Description2,20,10';

    s3ClientMock.send.mockResolvedValueOnce({
      Body: {
        transformToString: () => Promise.resolve(mockCsvContent)
      }
    });

    sqsClientMock.send.mockResolvedValue({
      MessageId: '12345'
    });

    const event = {
      Records: [{
        s3: {
          bucket: {
            name: 'test-bucket'
          },
          object: {
            key: 'uploaded/test.csv'
          }
        }
      }]
    };

    const result = await importFileParser(event);

    // Verify S3 client was called correctly
    expect(GetObjectCommand).toHaveBeenCalledWith({
      Bucket: 'XXXXXXXXXXXXXXXX',
      Key: 'uploaded/test.csv'
    });

    // Verify SQS was called for each product
    expect(SendMessageCommand).toHaveBeenCalledTimes(2);
    expect(SendMessageCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        MessageBody: expect.stringContaining('Product1')
      })
    );

    expect(result.statusCode).toBe(200);
  });

  test('should handle empty CSV file', async () => {
    s3ClientMock.send.mockResolvedValueOnce({
      Body: {
        transformToString: () => Promise.resolve('title,description,price,count\n')
      }
    });

    const event = {
      Records: [{
        s3: {
          bucket: {
            name: 'test-bucket'
          },
          object: {
            key: 'uploaded/empty.csv'
          }
        }
      }]
    };

    const result = await importFileParser(event);

    expect(SendMessageCommand).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(200);
  });

  test('should handle invalid CSV format', async () => {
    s3ClientMock.send.mockResolvedValueOnce({
      Body: {
        transformToString: () => Promise.resolve('invalid,csv,format\nwithout,proper,headers')
      }
    });

    const event = {
      Records: [{
        s3: {
          bucket: {
            name: 'test-bucket'
          },
          object: {
            key: 'uploaded/invalid.csv'
          }
        }
      }]
    };

    const result = await importFileParser(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('Invalid CSV format')
      })
    );
  });

  test('should handle S3 errors', async () => {
    s3ClientMock.send.mockRejectedValueOnce(new Error('S3 Error'));

    const event = {
      Records: [{
        s3: {
          bucket: {
            name: 'test-bucket'
          },
          object: {
            key: 'uploaded/test.csv'
          }
        }
      }]
    };

    const result = await importFileParser(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Internal Server Error'
    });
  });

  test('should handle SQS errors', async () => {
    s3ClientMock.send.mockResolvedValueOnce({
      Body: {
        transformToString: () => Promise.resolve('title,description,price,count\nProduct1,Description1,10,5')
      }
    });

    sqsClientMock.send.mockRejectedValueOnce(new Error('SQS Error'));

    const event = {
      Records: [{
        s3: {
          bucket: {
            name: 'test-bucket'
          },
          object: {
            key: 'uploaded/test.csv'
          }
        }
      }]
    };

    const result = await importFileParser(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Error sending message to SQS'
    });
  });
});
