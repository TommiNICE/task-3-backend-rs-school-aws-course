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
  
  const generateDenyResponse = (statusCode, message) => {
    return generatePolicy('user', '*', 'Deny', {
      context: {
        statusCode: statusCode,
        message: message
      }
    });
  };
  
  exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
  
    try {
      // Check if Authorization header exists
      if (!event.headers?.Authorization) {
        console.log('Missing Authorization header');
        return generateDenyResponse(401, 'Unauthorized');
      }
  
      // Extract and decode the Authorization header
      const authHeader = event.headers.Authorization;
      const encodedCreds = authHeader.split(' ')[1];
      
      if (!encodedCreds) {
        console.log('Invalid token format');
        return generateDenyResponse(403, 'invalid authorization_token');
      }
  
      try {
        const plainCreds = Buffer.from(encodedCreds, 'base64').toString().split(':');
        const username = plainCreds[0];
        const password = plainCreds[1];
  
        console.log('Checking credentials for:', username);
  
        // Check specifically for TommiNICE credentials
        if (username === 'TommiNICE' && password === 'TEST_PASSWORD') {
          console.log('Valid credentials');
          return generatePolicy(username, event.methodArn, 'Allow');
        } else {
          console.log('Invalid credentials');
          return generateDenyResponse(403, 'invalid authorization_token');
        }
  
      } catch (error) {
        console.log('Error decoding token:', error);
        return generateDenyResponse(403, 'invalid authorization_token');
      }
  
    } catch (error) {
      console.error('Error in authorizer:', error);
      return generateDenyResponse(403, 'invalid authorization_token');
    }
  };
  