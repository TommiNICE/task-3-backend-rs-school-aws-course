# Task 3 of AWS Developer Course by RS School

## Description
This project implements a serverless product API using AWS services. The infrastructure is defined using AWS CDK and consists of Lambda functions and API Gateway endpoints for managing product information.

## Architecture
- **AWS Lambda Functions**:
  - `getProductsList`: Returns all available products
  - `getProductsById`: Returns a specific product by ID
- **API Gateway**: RESTful API endpoints
- **Authentication**: AWS SSO (Single Sign-On)

## API Endpoints
- GET `/products` - Retrieve all products
- GET `/products/{id}` - Retrieve a specific product by ID

## Product Schema
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "price": "number",
  "count": "integer"
}
```
## Prerequisites
* Node.js v20.x or later
* AWS CLI configured with SSO
* AWS CDK CLI installed ( npm install -g aws-cdk)

## Project Structure
```
task-3-backend-rs-school-aws-course/
├── bin/
│   └── task-3-backend-rs-school-aws-course.js
├── lambda/
│   └── index.js
├── cdk.json
├── package.json
├── README.md
└── swagger.yml
```

## Setup and Deployment
1. Install Dependencies

`npm install`

2. Configure AWS SSO
```
aws configure sso
aws sso login --profile your-profile-name
export AWS_PROFILE=your-profile-name
```

3. Deploy the Stack
```
cdk bootstrap
cdk deploy
```

## Useful Commands
* `cdk synth` - Synthesize CloudFormation template

* `cdk bootstrap` - Bootstrap CDK resources in AWS account

* `cdk deploy` - Deploy the stack

* `cdk diff` - Compare deployed stack with current state

* `cdk destroy` - Remove the stack from AWS

## API Documentation
API documentation is available in OpenAPI/Swagger format in swagger.yml. You can visualize it using Swagger UI or import it into API management tools.

## Error Handling
The API implements the following error responses:

* 404 - Product not found

* 500 - Internal server error

## CORS
The API includes CORS headers to allow cross-origin requests with the following configuration:

* Access-Control-Allow-Origin: *

* Access-Control-Allow-Credentials: true

## Environment Variables
The Lambda functions use the following environment variables:

* PRODUCTS - JSON string containing product data

## License
This project is part of the RS School AWS Developer Course.

## API URL
https://sav7k3rrw0.execute-api.eu-north-1.amazonaws.com/prod/products/
