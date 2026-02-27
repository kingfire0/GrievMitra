// Netlify Serverless Function
// This wraps the backend server for Netlify deployment

const app = require('../../backend/server.js');

// Netlify serverless function handler
exports.handler = async (event, context) => {
  // Convert Netlify event to Express req/res format
  return new Promise((resolve) => {
    const req = {
      ...event,
      headers: event.headers,
      method: event.httpMethod,
      url: event.path,
      body: event.body,
      query: event.queryStringParameters
    };

    const res = {
      statusCode: 200,
      headers: {},
      body: '',
      status(code) {
        this.statusCode = code;
        return this;
      },
      setHeader(key, value) {
        this.headers[key] = value;
        return this;
      },
      send(body) {
        this.body = body;
        resolve({
          statusCode: this.statusCode,
          headers: this.headers,
          body: typeof body === 'string' ? body : JSON.stringify(body)
        });
      },
      json(body) {
        this.headers['Content-Type'] = 'application/json';
        this.send(JSON.stringify(body));
      },
      redirect(url) {
        resolve({
          statusCode: 302,
          headers: {
            ...this.headers,
            'Location': url
          },
          body: ''
        });
      }
    };

    // Call the Express app
    app(req, res);
  });
};
