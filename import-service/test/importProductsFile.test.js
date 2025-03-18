const AWS = require('aws-sdk');
const { handler: importProductsFile } = require('../lambda/importProductsFile/index');

// Mock S3 client
jest.mock('aws-sdk', () => {
  return {
    S3: jest.fn(() => ({
      getSignedUrl: jest.fn()
    }))
  };
});

describe('importProductsFile lambda', () => {
  let s3Mock;
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup S3 mock
    s3Mock = new AWS.S3();
  });

  test('should return signed URL for valid CSV file', async () => {
    // Setup mock response
    const mockSignedUrl = 'https://XXXXXXXXXXXXXXXXXXXXXXXXXXXX/uploaded/test.csv';
    s3Mock.getSignedUrl.mockImplementation((operation, params, callback) => mockSignedUrl);

    const event = {
      queryStringParameters: {
        name: 'test.csv'
      }
    };

    const result = await importProductsFile(event);

    // Verify response
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toBe(mockSignedUrl);

    // Verify S3 client was called with correct parameters
    expect(s3Mock.getSignedUrl).toHaveBeenCalledWith(
      'putObject',
      expect.objectContaining({
        Bucket: expect.any(String),
        Key: 'uploaded/test.csv',
        Expires: expect.any(Number),
        ContentType: 'text/csv'
      })
    );
  });

  test('should return 400 if filename is missing', async () => {
    const event = {
      queryStringParameters: {}
    };

    const result = await importProductsFile(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: 'File name is required'
    });
  });

  test('should return 400 if file is not CSV', async () => {
    const event = {
      queryStringParameters: {
        name: 'test.txt'
      }
    };

    const result = await importProductsFile(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Only CSV files are allowed'
    });
  });

  test('should handle S3 errors properly', async () => {
    // Setup mock to throw error
    s3Mock.getSignedUrl.mockImplementation(() => {
      throw new Error('S3 Error');
    });

    const event = {
      queryStringParameters: {
        name: 'test.csv'
      }
    };

    const result = await importProductsFile(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Internal Server Error'
    });
  });
});
