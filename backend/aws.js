const AWS = require('aws-sdk');

// Set the region and access keys
AWS.config.update({
    region: 'us-east-2',
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_ACCESS_SECRET
});

// Create a new instance of the S3 class
const s3 = new AWS.S3();

// Saves competitionData to S3 bucket
function saveCompetitionData(comps) {
  // Set the parameters for the file
  const params = {
      Bucket: 'southeast-cubing.org',
      Key: 'competitions.json',
      Body: JSON.stringify(comps)
  };

  // Upload the file to S3
  s3.upload(params, (err, data) => {
      if (err) {
          console.log('Error uploading file:', err);
      } else {
          console.log('File uploaded successfully. File location:', data.Location);
      }
  });  
}

function getCompetitionData(callback) {
  // Set the parameters for the file
  const params = {
    Bucket: 'southeast-cubing.org',
    Key: 'competitions.json',
  };

  // get parameters
  s3.getObject(params, (err, data) => {
    if (err) {
        console.log('Error retrieving file:', err);
    } else {
        console.log('File retrieved successfully');
        return callback(JSON.parse(data.Body))
    }
  });
}

module.exports = { sendEmail };
