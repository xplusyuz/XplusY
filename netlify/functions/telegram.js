export async function handler(event) {
  const { id, username, first_name } = JSON.parse(event.body);

  return {
    statusCode: 200,
    body: JSON.stringify({
      telegram_id: id,
      username: username || first_name
    })
  };
}
