package service

import (
	"bytes"
	"fmt"
	"io"
	"math/rand"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"golang.org/x/net/html"
)

// ParseResult holds metadata extracted from a webpage.
type ParseResult struct {
	Title       string `json:"title,omitempty"`
	Description string `json:"description,omitempty"`
	Icon        string `json:"icon,omitempty"`
	Image       string `json:"image,omitempty"`
}

var userAgents = []string{
	"Mozilla/5.0 (compatible; NavServer/1.0; +https://github.com/yingxiaomo/nav)",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
}

func pickUserAgent() string {
	return userAgents[rand.Intn(len(userAgents))]
}

// isPrivateHost checks whether the given hostname is a private/internal address (SSRF protection).
func IsPrivateHost(hostname string) bool {
	h := strings.ToLower(strings.TrimSpace(hostname))

	// Exact private hostnames
	privateExact := []string{"localhost", "127.0.0.1", "0.0.0.0", "::1", "::"}
	for _, p := range privateExact {
		if h == p {
			return true
		}
	}

	// Private domain suffixes
	if strings.HasSuffix(h, ".local") || strings.HasSuffix(h, ".internal") || strings.HasSuffix(h, ".lan") {
		return true
	}

	// Try parsing as standard IP address
	if ip := net.ParseIP(h); ip != nil {
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() {
			return true
		}
		// Additional IPv4-mapped IPv6 checks
		if ip4 := ip.To4(); ip4 != nil {
			if ip4[0] == 10 || ip4[0] == 127 {
				return true
			}
			if ip4[0] == 172 && ip4[1] >= 16 && ip4[1] <= 31 {
				return true
			}
			if ip4[0] == 192 && ip4[1] == 168 {
				return true
			}
		}
		return false
	}

	// Parse as bare IPv4 dotted notation (net.ParseIP may not cover all edge cases)
	parts := strings.Split(h, ".")
	if len(parts) == 4 {
		a, err1 := strconv.Atoi(parts[0])
		b, err2 := strconv.Atoi(parts[1])
		if err1 == nil && err2 == nil {
			if a == 10 {
				return true
			}
			if a == 172 && b >= 16 && b <= 31 {
				return true
			}
			if a == 192 && b == 168 {
				return true
			}
			if a == 127 {
				return true
			}
		}
	}

	// IPv6 raw address (with brackets stripped or not)
	if strings.Contains(h, ":") {
		cleanH := strings.Trim(h, "[]")
		if ip := net.ParseIP(cleanH); ip != nil {
			return ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsPrivate()
		}
	}

	return false
}

// resolveURL converts a possibly-relative URL to absolute using the base URL.
func resolveURL(href, base string) string {
	if strings.HasPrefix(href, "http://") || strings.HasPrefix(href, "https://") {
		return href
	}
	baseURL, err := url.Parse(base)
	if err != nil {
		return href
	}
	ref, err := url.Parse(href)
	if err != nil {
		return href
	}
	return baseURL.ResolveReference(ref).String()
}

// detectCharset attempts to extract the charset from Content-Type or HTML meta tag.
// If not found, returns "utf-8".
func detectCharset(contentType string, body []byte) string {
	// Try Content-Type header first
	if contentType != "" {
		idx := strings.Index(strings.ToLower(contentType), "charset=")
		if idx >= 0 {
			cs := contentType[idx+8:]
			if semi := strings.IndexByte(cs, ';'); semi >= 0 {
				cs = cs[:semi]
			}
			if cs = strings.TrimSpace(cs); cs != "" {
				return strings.ToLower(cs)
			}
		}
	}

	// Try HTML <meta charset="...">
	bodyStr := string(body)
	if m := extractAttr(bodyStr, "meta", "charset"); m != "" {
		return strings.ToLower(strings.TrimSpace(m))
	}

	return "utf-8"
}

// extractAttr finds the value of a named attribute from the first matching element tag.
// Simple string-based extraction, works for <meta charset="utf-8"> etc.
func extractAttr(htmlStr, tagName, attrName string) string {
	// Build a regex-like search: find <tagName ... attrName="value"...>
	lower := strings.ToLower(htmlStr)
	tagStart := strings.Index(lower, "<"+tagName)
	if tagStart < 0 {
		return ""
	}
	tagEnd := strings.IndexByte(htmlStr[tagStart:], '>')
	if tagEnd < 0 {
		return ""
	}
	tag := htmlStr[tagStart : tagStart+tagEnd]

	// Look for attrName="value" or attrName='value' or attrName=value
	searchFor := strings.ToLower(attrName) + "="
	lowerTag := strings.ToLower(tag)
	attrIdx := strings.Index(lowerTag, searchFor)
	if attrIdx < 0 {
		return ""
	}

	after := tag[attrIdx+len(searchFor):]
	if len(after) == 0 {
		return ""
	}

	var quote byte
	var end int
	if after[0] == '"' || after[0] == '\'' {
		quote = after[0]
		end = strings.IndexByte(after[1:], quote)
		if end < 0 {
			return after[1:]
		}
		return after[1 : 1+end]
	}

	// Unquoted value
	end = strings.IndexAny(after, " >")
	if end < 0 {
		return after
	}
	return after[:end]
}

// ParseURL fetches a URL and extracts page metadata (title, description, icon, og:image).
func ParseURL(rawURL string) (*ParseResult, error) {
	// 1. Normalize and validate URL
	if !strings.HasPrefix(rawURL, "http://") && !strings.HasPrefix(rawURL, "https://") {
		rawURL = "https://" + rawURL
	}

	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("无效的 URL: %w", err)
	}

	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return nil, fmt.Errorf("不支持的协议: %s", parsedURL.Scheme)
	}

	// 2. SSRF protection — check before request
	if IsPrivateHost(parsedURL.Hostname()) {
		return nil, fmt.Errorf("不允许访问内网地址")
	}

	// 3. Fetch the page
	client := &http.Client{
		Timeout: 5 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return fmt.Errorf("重定向次数过多")
			}
			// Re-check SSRF on redirect target
			if IsPrivateHost(req.URL.Hostname()) {
				return fmt.Errorf("不允许访问内网地址")
			}
			return nil
		},
	}

	req, err := http.NewRequest("GET", parsedURL.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("User-Agent", pickUserAgent())
	req.Header.Set("Accept", "text/html,application/xhtml+xml")

	resp, err := client.Do(req)
	if err != nil {
		if strings.Contains(err.Error(), "超时") || strings.Contains(err.Error(), "timeout") || strings.Contains(err.Error(), "Timeout") {
			return nil, fmt.Errorf("请求超时")
		}
		return nil, fmt.Errorf("无法访问目标网址")
	}
	defer resp.Body.Close()

	// Re-check SSRF after redirect
	redirectURL, err := url.Parse(resp.Request.URL.String())
	if err == nil && redirectURL.Hostname() != parsedURL.Hostname() {
		if IsPrivateHost(redirectURL.Hostname()) {
			return nil, fmt.Errorf("不允许访问内网地址")
		}
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 400 {
		return nil, fmt.Errorf("目标网址返回 %d", resp.StatusCode)
	}

	// 4. Read body with size limit
	limitedReader := io.LimitReader(resp.Body, int64(1<<20)) // 1MB
	body, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败")
	}

	// 5. Detect charset and decode
	contentType := resp.Header.Get("Content-Type")
	charset := detectCharset(contentType, body)

	// If charset is not UTF-8, try common conversions; otherwise just use as-is.
	htmlBody := string(body)
	if charset != "utf-8" && charset != "" {
		// For Go, the body is always raw bytes. If it's not UTF-8, the text content
		// may be garbled, but HTML tag/attribute extraction still works since tags
		// use ASCII characters. We don't add a full charset conversion dependency.
		// The raw string is still useful for tag extraction.
	}

	// 6. Parse HTML
	baseURLStr := fmt.Sprintf("%s://%s", parsedURL.Scheme, parsedURL.Host)
	result := parseHTMLDocument(body, baseURLStr, htmlBody)

	// Fallback icon
	if result.Icon == "" {
		result.Icon = resolveURL("/favicon.ico", baseURLStr)
	}

	return result, nil
}

// parseHTMLDocument extracts metadata from an HTML document.
func parseHTMLDocument(body []byte, baseURL string, bodyStr string) *ParseResult {
	result := &ParseResult{}

	// Try HTML tokenizer for accurate parsing
	doc, err := html.Parse(bytes.NewReader(body))
	if err != nil {
		// Fallback to string-based extraction
		return parseHTMLSimple(bodyStr, baseURL)
	}

	extractFromNode(doc, result, baseURL)

	// If html.Parse found nothing useful (e.g., malformed HTML), fallback to string matching
	if result.Title == "" && result.Description == "" && result.Icon == "" {
		fallback := parseHTMLSimple(bodyStr, baseURL)
		if result.Title == "" {
			result.Title = fallback.Title
		}
		if result.Description == "" {
			result.Description = fallback.Description
		}
		if result.Icon == "" {
			result.Icon = fallback.Icon
		}
		if result.Image == "" {
			result.Image = fallback.Image
		}
	}

	return result
}

// extractFromNode recursively walks an HTML node tree to extract metadata.
func extractFromNode(n *html.Node, result *ParseResult, baseURL string) {
	if n.Type == html.ElementNode {
		switch n.Data {
		case "title":
			if result.Title == "" && n.FirstChild != nil {
				title := strings.TrimSpace(n.FirstChild.Data)
				if title != "" {
					result.Title = title
				}
			}
		case "meta":
			var name, content, property string
			for _, attr := range n.Attr {
				switch attr.Key {
				case "name":
					name = strings.ToLower(attr.Val)
				case "property":
					property = strings.ToLower(attr.Val)
				case "content":
					content = strings.TrimSpace(attr.Val)
				}
			}
			if content == "" {
				break
			}

			// <meta name="description" content="...">
			if name == "description" && result.Description == "" {
				result.Description = content
			}
			// <meta property="og:image" content="...">
			if property == "og:image" && result.Image == "" {
				result.Image = resolveURL(content, baseURL)
			}
			// <meta name="twitter:image" content="...">
			if name == "twitter:image" && result.Image == "" {
				result.Image = resolveURL(content, baseURL)
			}
			// <meta property="twitter:image" content="...">
			if property == "twitter:image" && result.Image == "" {
				result.Image = resolveURL(content, baseURL)
			}
		case "link":
			var rel, href string
			for _, attr := range n.Attr {
				switch attr.Key {
				case "rel":
					rel = strings.ToLower(attr.Val)
				case "href":
					href = attr.Val
				}
			}
			if href == "" {
				break
			}
			if (rel == "icon" || rel == "shortcut icon" || rel == "apple-touch-icon") && result.Icon == "" {
				result.Icon = resolveURL(href, baseURL)
			}
		}
	}

	for c := n.FirstChild; c != nil; c = c.NextSibling {
		extractFromNode(c, result, baseURL)
	}
}

// parseHTMLSimple uses regex-like string matching to extract metadata without
// a full HTML parser. Used as fallback for malformed HTML.
func parseHTMLSimple(htmlStr string, baseURL string) *ParseResult {
	result := &ParseResult{}

	// Title
	if match := extractBetween(htmlStr, "<title", "</title>"); match != "" {
		// Find the end of the opening tag
		closeTag := strings.IndexByte(match, '>')
		if closeTag >= 0 {
			title := match[closeTag+1:]
			title = stripHTMLTags(title)
			title = strings.TrimSpace(title)
			title = collapseWhitespace(title)
			if title != "" {
				result.Title = title
			}
		}
	}

	// Meta description
	if desc := extractMetaValue(htmlStr, "description"); desc != "" {
		result.Description = desc
	}

	// OG image
	if ogImage := extractMetaValue(htmlStr, "og:image"); ogImage != "" {
		result.Image = resolveURL(ogImage, baseURL)
	}
	if result.Image == "" {
		if twitterImage := extractMetaValue(htmlStr, "twitter:image"); twitterImage != "" {
			result.Image = resolveURL(twitterImage, baseURL)
		}
	}

	// Icon
	icon := extractIconHref(htmlStr)
	if icon != "" {
		result.Icon = resolveURL(icon, baseURL)
	}

	return result
}

// extractBetween returns the content between startTag (searching for its '<' form
// and skipping to the first '>' after it) and endTag (last occurrence before
// the next opening tag or EOF).
func extractBetween(s, start, end string) string {
	startIdx := strings.Index(strings.ToLower(s), strings.ToLower(start))
	if startIdx < 0 {
		return ""
	}
	contentStart := startIdx + len(start)
	return s[contentStart:]
}

// stripHTMLTags removes all HTML tags from a string.
func stripHTMLTags(s string) string {
	var buf strings.Builder
	inTag := false
	for i := 0; i < len(s); i++ {
		if s[i] == '<' {
			inTag = true
			continue
		}
		if s[i] == '>' {
			inTag = false
			continue
		}
		if !inTag {
			buf.WriteByte(s[i])
		}
	}
	return buf.String()
}

// collapseWhitespace replaces sequences of whitespace with a single space.
func collapseWhitespace(s string) string {
	fields := strings.Fields(s)
	return strings.Join(fields, " ")
}

// extractMetaValue extracts the content of a <meta> element by name or property.
func extractMetaValue(htmlStr, name string) string {
	lower := strings.ToLower(htmlStr)
	searchName := strings.ToLower(name)

	start := 0
	for {
		idx := strings.Index(lower[start:], `<meta`)
		if idx < 0 {
			break
		}
		tagStart := start + idx
		tagEnd := strings.IndexByte(htmlStr[tagStart:], '>')
		if tagEnd < 0 {
			break
		}
		tag := lower[tagStart : tagStart+tagEnd]

		// Check if name or property matches
		hasName := strings.Contains(tag, `name="`+searchName+`"`) ||
			strings.Contains(tag, `name='`+searchName+`'`) ||
			strings.Contains(tag, `property="`+searchName+`"`) ||
			strings.Contains(tag, `property='`+searchName+`'`)

		if hasName {
			// Extract content value
			return extractAttrValue(tag, "content")
		}

		start = tagStart + tagEnd + 1
	}

	return ""
}

// extractAttrValue extracts the value of a named attribute from a tag string.
func extractAttrValue(tag, attrName string) string {
	searchFor := attrName + "="
	idx := strings.Index(tag, searchFor)
	if idx < 0 {
		return ""
	}
	after := tag[idx+len(searchFor):]
	if len(after) == 0 {
		return ""
	}
	if after[0] == '"' {
		end := strings.IndexByte(after[1:], '"')
		if end < 0 {
			return after[1:]
		}
		return after[1 : 1+end]
	}
	if after[0] == '\'' {
		end := strings.IndexByte(after[1:], '\'')
		if end < 0 {
			return after[1:]
		}
		return after[1 : 1+end]
	}
	// Unquoted
	end := strings.IndexAny(after, " >")
	if end < 0 {
		return after
	}
	return after[:end]
}

// extractIconHref extracts the href from a <link rel="icon" ...> tag.
func extractIconHref(htmlStr string) string {
	lower := strings.ToLower(htmlStr)
	start := 0
	for {
		idx := strings.Index(lower[start:], `<link`)
		if idx < 0 {
			break
		}
		tagStart := start + idx
		tagEnd := strings.IndexByte(htmlStr[tagStart:], '>')
		if tagEnd < 0 {
			break
		}
		tag := lower[tagStart : tagStart+tagEnd]

		if strings.Contains(tag, `rel="icon"`) ||
			strings.Contains(tag, `rel='icon'`) ||
			strings.Contains(tag, `rel="shortcut icon"`) ||
			strings.Contains(tag, `rel='shortcut icon'`) ||
			strings.Contains(tag, `rel="apple-touch-icon"`) ||
			strings.Contains(tag, `rel='apple-touch-icon'`) {
			if href := extractAttrValue(tag, "href"); href != "" {
				return href
			}
		}

		start = tagStart + tagEnd + 1
	}
	return ""
}
