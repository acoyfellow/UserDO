module.exports = {
  default: {
    sign: async (payload, secret) => {
      return `mocked.${Buffer.from(JSON.stringify(payload)).toString('base64')}.${secret}`;
    },
    verify: async (token, secret) => {
      if (token.includes('invalid')) return false;
      return true;
    },
    decode: (token) => {
      try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        return { payload };
      } catch {
        return null;
      }
    }
  }
};
