require('dotenv').config();

const generatePolicy = (principalId, resource, effect = 'Allow') => {
    return {
        principalId,
        policyDocument: {
            Version: '2012-10-17',
            Statement: [
                {
                    Action: 'execute-api:Invoke',
                    Effect: effect,
                    Resource: resource
                }
            ]
        }
    };
};

const validateInput = (event) => {
    if (!event || !event.headers) {
        throw new Error('Invalid event structure');
    }

    if (!event.methodArn) {
        throw new Error('Missing methodArn');
    }
};

const sanitizeUsername = (username) => {
    // Remove any special characters that could be used for injection
    return username.replace(/[^a-zA-Z0-9_]/g, '');
};

const validateCredentials = (username, password) => {
    // Add additional validation rules
    if (!username || !password) {
        return false;
    }

    if (username.length > 100 || password.length > 100) {
        return false;
    }

    return true;
};

const decodeAuthToken = (authHeader) => {
    try {
        const [authType, encodedToken] = authHeader.split(' ');
        if (authType.toLowerCase() !== 'basic') {
            throw new Error('Unsupported authorization type');
        }

        const token = Buffer.from(encodedToken, 'base64').toString('utf-8');
        const [username, password] = token.split(':');

        if (!validateCredentials(username, password)) {
            throw new Error('Invalid credentials format');
        }

        return {
            username: sanitizeUsername(username),
            password
        };
    } catch (error) {
        console.error('Token decode error:', error);
        return null;
    }
};

const handleError = (error) => {
    console.error('Error:', error);
    return {
        statusCode: 500,
        body: 'Internal Server Error'
    };
};

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
  
    try {
      // Check if Authorization header exists
      if (!event.headers?.Authorization) {
        return {
          statusCode: 401,
          body: 'Unauthorized: No Authorization header'
        };
      }
  
      // Extract and decode the Authorization header
      const authHeader = event.headers.Authorization;
      const encodedCreds = authHeader.split(' ')[1];
      
      // Check if the token is properly formatted
      if (!encodedCreds) {
        return {
          statusCode: 403,
          body: 'invalid authorization_token'
        };
      }
  
      try {
        const plainCreds = Buffer.from(encodedCreds, 'base64').toString().split(':');
        const username = plainCreds[0];
        const password = plainCreds[1];
  
        // Check specifically for TommiNICE credentials
        if (username !== 'TommiNICE' || password !== 'TEST_PASSWORD') {
          return {
            statusCode: 403,
            body: 'invalid authorization_token'
          };
        }
  
        return generatePolicy(username, event.methodArn);
  
      } catch (error) {
        return {
          statusCode: 403,
          body: 'invalid authorization_token'
        };
      }
  
    } catch (error) {
      console.error('Error:', error);
      return {
        statusCode: 500,
        body: 'Internal server error'
      };
    }
  };
