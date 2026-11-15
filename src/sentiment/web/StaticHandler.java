package sentiment.web;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import sentiment.util.Res;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Serves the three files of the web page. Only these exact names are served, so a request such as
 * /../data/history.csv can never read other files from the machine.
 */
public final class StaticHandler implements HttpHandler {
    private static final Map<String, String> FILES = Map.of(
            "/index.html", "text/html",
            "/app.js", "application/javascript",
            "/style.css", "text/css");

    @Override public void handle(HttpExchange ex) throws IOException {
        String path = ex.getRequestURI().getPath();
        if (path == null || path.isEmpty() || path.equals("/")) path = "/index.html";
        String type = FILES.get(path);
        String content = type == null ? null : Res.readDefault("web" + path);
        if (content == null) { ex.sendResponseHeaders(404, -1); ex.close(); return; }
        byte[] data = content.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", type + "; charset=utf-8");
        ex.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
        ex.sendResponseHeaders(200, data.length);
        try (OutputStream os = ex.getResponseBody()) { os.write(data); }
    }
}
