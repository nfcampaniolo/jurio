const emailStyles = `
  body {
    margin: 0;
    padding: 0;
    background-color: #f5f6f7;
    color: #1a1d21;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 16px;
    line-height: 1.75;
  }

  .container {
    max-width: 600px;
    margin: 0 auto;
    background-color: #ffffff;
    padding: 30px 25px;
    border-radius: 8px;
    border: 1px solid #d6d9de;
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.08);
  }

  .header {
    text-align: center;
    padding-bottom: 20px;
  }

  .header h1 {
    font-family: "Times New Roman", Times, serif;
    font-size: 28px;
    font-weight: 700;
    margin: 0;
    color: #1a1d21;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .subheader {
    text-align: center;
    color: #5f6672;
    font-size: 16px;
    margin: 15px 0 30px 0;
  }

  .feature {
    background-color: #f5f6f7;
    padding: 20px;
    border-radius: 6px;
    margin-bottom: 20px;
    border-left: 4px solid #2b2f36;
  }

  .feature h3 {
    font-family: "Times New Roman", Times, serif;
    margin: 0 0 8px 0;
    color: #2b2f36;
    font-size: 20px;
    font-weight: 600;
  }

  .feature p {
    margin: 0;
    font-size: 15px;
    color: #1a1d21;
  }

  .button {
    display: inline-block;
    margin: 30px 0;
    padding: 14px 24px;
    background-color: #2b2f36;
    color: #ffffff !important;
    text-decoration: none;
    font-weight: 600;
    font-size: 16px;
    border-radius: 6px;
    text-align: center;
  }

  .button:hover {
    background-color: #1f2329;
  }

  .footer {
    font-size: 13px;
    color: #5f6672;
    text-align: center;
    padding-top: 20px;
    line-height: 1.5;
  }

  a {
    color: #2b2f36;
    text-decoration: underline;
  }

  @media (max-width: 600px) {
    .container {
      padding: 20px 15px;
    }

    .header h1 {
      font-size: 24px;
    }

    .subheader {
      font-size: 14px;
      margin-bottom: 25px;
    }

    .feature h3 {
      font-size: 18px;
    }

    .feature p {
      font-size: 14px;
    }

    .button {
      width: 100%;
      font-size: 15px;
      padding: 12px 0;
    }
  }
`;

export default emailStyles;