const AWS = require('aws-sdk');
const csv = require('csv-parser');
const s3 = new AWS.S3();
const sqs = new AWS.SQS();

exports.handler = async (event) => {
  try {
    const s3Record = event.Records[0];
    const bucket = s3Record.s3.bucket.name;
    const key = decodeURIComponent(s3Record.s3.object.key.replace(/\+/g, ' '));
    
    const s3Stream = s3.getObject({
      Bucket: bucket,
      Key: key
    }).createReadStream();

    const records = [];
    
    await new Promise((resolve, reject) => {
      s3Stream
        .pipe(csv())
        .on('data', (data) => records.push(data))
        .on('error', reject)
        .on('end', resolve);
    });

    // Process records in batches of 10
    for (let i = 0; i < records.length; i += 10) {
      const batch = records.slice(i, i + 10);
      const entries = batch.map((record, index) => ({
        Id: `${i + index}`,
        MessageBody: JSON.stringify(record)
      }));

      if (entries.length > 0) {
        await sqs.sendMessageBatch({
          QueueUrl: process.env.QUEUE_URL,
          Entries: entries
        }).promise();
      }
    }

    return {
      statusCode: 200,
      body: `Successfully processed ${records.length} records`
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
