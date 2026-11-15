package sentiment;

import sentiment.service.AnalysisService;
import sentiment.web.Server;

/**
 * Sentiment Analysis Web Application - entry point.
 * Run:  java sentiment.Main [port]
 * Settings (all optional):
 *   PORT         port to listen on (cloud hosts set this); default 8080
 *   READ_ONLY    "true" blocks every endpoint that changes data (use it for a public demo)
 *   NO_BROWSER   any value: do not try to open a browser window
 */
public final class Main {
    public static void main(String[] args) throws Exception {
        int port = args.length > 0 ? Integer.parseInt(args[0])
                : System.getenv("PORT") != null ? Integer.parseInt(System.getenv("PORT").trim()) : 8080;
        boolean readOnly = "true".equalsIgnoreCase(System.getenv("READ_ONLY"));
        AnalysisService service = new AnalysisService();
        Server server = new Server(service, port, readOnly);
        server.start();
        String url = "http://localhost:" + port;
        System.out.println("Sentiment Analysis app running at " + url + (readOnly ? "  [read-only]" : "") + "  (Ctrl+C to stop)");
        if (System.getenv("NO_BROWSER") != null || java.awt.GraphicsEnvironment.isHeadless()) return;
        try { java.awt.Desktop.getDesktop().browse(new java.net.URI(url)); }
        catch (Throwable ignored) { System.out.println("Open " + url + " in your browser."); }
    }
}
