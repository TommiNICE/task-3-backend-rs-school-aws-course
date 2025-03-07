const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const csv = require('csv-parser');
const { Readable } = require('stream');

const s3Client = new S3Client({});

exports.handler = async (event) => {
    console.log('ImportFileParser called with event:', JSON.stringify(event, null, 2));

    try {
        // Get the S3 bucket and key from the event
        const record = event.Records[0];
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(record.s3.object.key);

        console.log(`Processing file ${key} from bucket ${bucket}`);

        // Get the file from S3
        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: key
        });

        const response = await s3Client.send(command);
        const stream = response.Body;

        // Parse the CSV
        await new Promise((resolve, reject) => {
            const readable = Readable.from(stream);
            
            readable
                .pipe(csv())
                .on('data', (data) => {
                    console.log('Parsed CSV record:', JSON.stringify(data));
                })
                .on('end', async () => {
                    console.log('CSV parsing completed');
                    resolve();
                })
                .on('error', (error) => {
                    console.error('Error parsing CSV:', error);
                    reject(error);
                });
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'CSV processing completed successfully'
            })
        };

    } catch (error) {
        console.error('Error processing file:', error);
        throw error;
    }
};
