// AWS configuration - credentials are no longer needed in browser
// All AWS operations go through the backend API

const awsConfig = {
  region: import.meta.env.VITE_AWS_REGION || "us-east-1",
};

export default awsConfig;
