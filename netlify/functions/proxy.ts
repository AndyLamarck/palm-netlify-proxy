import { Context, RequestInit } // RequestInit might not be strictly needed to import if using global web types
  from "@netlify/edge-functions"; // Assuming RequestInit comes from here or is a global type

const pickHeaders = (headers: Headers, keys: (string | RegExp)[]): Headers => {
  const picked = new Headers();
  for (const key of headers.keys()) {
    if (keys.some((k) => (typeof k === "string" ? k === key : k.test(key)))) {
      const value = headers.get(key);
      if (typeof value === "string") {
        picked.set(key, value);
      }
    }
  }
  return picked;
};

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "*",
  "access-control-allow-headers": "*",
};

export default async (request: Request, context: Context) => {

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: CORS_HEADERS,
    });
  }

  const { pathname, searchParams } = new URL(request.url);
  if(pathname === "/") {
    let blank_html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Google PaLM API proxy on Netlify Edge</title>
</head>
<body>
  <h1 id="google-palm-api-proxy-on-netlify-edge">Google PaLM API proxy on Netlify Edge</h1>
  <p>Tips: This project uses a reverse proxy to solve problems such as location restrictions in Google APIs. </p>
  <p>If you have any of the following requirements, you may need the support of this project.</p>
  <ol>
  <li>When you see the error message &quot;User location is not supported for the API use&quot; when calling the Google PaLM API</li>
  <li>You want to customize the Google PaLM API</li>
  </ol>
  <p>For technical discussions, please visit <a href="https://simonmy.com/posts/google-palm-api-proxy-on-netlify-edge.html">https://simonmy.com/posts/google-palm-api-proxy-on-netlify-edge.html</a></p>
</body>
</html>
    `
    return new Response(blank_html, {
      headers: {
        ...CORS_HEADERS,
        "content-type": "text/html"
      },
    });
  }

  const url = new URL(pathname, "https://generativelanguage.googleapis.com");
  searchParams.delete("_path");

  searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  const headers = pickHeaders(request.headers, ["content-type", "authorization", "x-goog-api-client", "x-goog-api-key", "accept-encoding"]);

  // --- 开始修改的部分 ---
  // 准备 fetch 请求的选项
  const fetchOptions: RequestInit = { // RequestInit 是 TypeScript 中的类型，用于 fetch 的选项对象
    method: request.method,
    headers: headers,
  };

  // 如果原始请求包含 body (例如 POST, PUT 请求),
  // 我们需要把它传递过去，并且为了兼容 Netlify 使用的 Node.js 环境中的 fetch，
  // 需要添加 duplex: 'half' 选项。
  if (request.body && (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH')) {
    fetchOptions.body = request.body;
    fetchOptions.duplex = 'half'; // <--- 这是关键的修复！
  }
  // 对于 GET, HEAD, DELETE 等没有 body 的请求，上面的 if 条件不会满足，挺好。

  // 使用修改后的选项发起 fetch 请求
  const response = await fetch(url.toString(), fetchOptions); // url.toString() 更安全
  // --- 修改结束的部分 ---

  const responseHeaders = {
    ...CORS_HEADERS,
    ...Object.fromEntries(response.headers), // 注意：这里直接展开 response.headers 可能需要过滤或调整
  };

  return new Response(response.body, {
    headers: responseHeaders,
    status: response.status
  });
};
