const AWS = require('aws-sdk');

// Logger
const log4js = require('log4js');
const logger = log4js.getLogger();
logger.level = 'debug';

// Set the region and access keys
AWS.config.update({
  region: 'us-east-2',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// Create a new instance of the S3 class
const s3 = new AWS.S3();

// Feature flag gating whether saveCompetitionData() actually writes to S3. Defaults
// to disabled so local smoke-testing never overwrites the real production
// competitions.json file by accident - set AWS_S3_WRITE_ENABLED="true" (production's
// env file does this) to actually write.
const s3WriteEnabled = process.env.AWS_S3_WRITE_ENABLED === 'true';

// Saves competitionData to S3 bucket
function saveCompetitionData(comps) {
  if (!s3WriteEnabled) {
    logger.info('Skipping S3 write - AWS_S3_WRITE_ENABLED is not set to true.');
    return;
  }

  // Set the parameters for the file
  const params = {
    Bucket: 'southeast-cubing.org',
    Key: 'competitions.json',
    Body: JSON.stringify(comps),
  };

  // Upload the file to S3
  s3.upload(params, (err) => {
    if (err) {
      logger.error('Error uploading file to S3: ', err);
    } else {
      logger.info('Competition file uploaded successfully to S3.');
    }
  });
}

function getCompetitionData(callback) {
  // Set the parameters for the file
  const params = {
    Bucket: 'southeast-cubing.org',
    Key: 'competitions.json',
  };

  // get Data from S3 bucket
  s3.getObject(params, (err, data) => {
    if (err) {
      logger.error('Error retrieving file from S3: ', err);
    } else {
      logger.info('Successfully retrieved file from S3.');
      return callback(JSON.parse(data.Body));
    }
  });
}

module.exports = { saveCompetitionData, getCompetitionData };
