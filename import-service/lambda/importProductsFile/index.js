const { S3Client } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({});

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event));
    
    try {
        // Validate input
        if (!event.queryStringParameters?.name) {
            return formatResponse(400, {
                message: 'Missing required query parameter: name'
            });
        }

        const fileName = event.queryStringParameters.name;
        
        if (!fileName.endsWith('.csv')) {
            return formatResponse(400, {
                message: 'File must be a CSV'
            });
        }

        const command = new PutObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: `uploaded/${fileName}`,
            ContentType: 'text/csv'
        });

        const signedUrl = await getSignedUrl(s3Client, command, {
            expiresIn: 3600 // 1 hour
        });

        return formatResponse(200, { signedUrl });

    } catch (error) {
        console.error('Error:', error);
        return formatResponse(500, {
            message: 'Internal server error',
            error: error.message
        });
    }
};

const formatResponse = (statusCode, body) => ({
    statusCode,
    headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
});
