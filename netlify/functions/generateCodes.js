exports.handler = async (event) => {
  const { count } = JSON.parse(event.body);
  const codes = Array.from({ length: count }, () =>
    Math.random().toString(36).substring(2, 10).toUpperCase()
  );

  // TODO: kodlarni Netlify KV yoki faylga saqlash
  return {
    statusCode: 200,
    body: JSON.stringify({ codes })
  };
};
