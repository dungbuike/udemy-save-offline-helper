# Udemy Offline Helper 1.1.1

Extension Chrome / Edge 116+ cho máy tính. Tải từng bài giảng HLS MPEG-TS không mã hóa từ tab Udemy bạn đang xem.

## Sửa tên bài ở 1.1.1

- Đọc `li[aria-current="true"] [data-purpose="item-title"]` ngay trên trang Udemy. Không phụ thuộc tên class có hậu tố thay đổi.
- Giữ số thứ tự hiển thị: ví dụ **161. Rekognition Overview.ts**.
- Đối chiếu ID `item-completion-state-35038620` với ID bài trong URL `/lecture/35038620` khi có cả hai; nếu trang đang chuyển bài thì yêu cầu chờ và làm mới.
- Popup hiển thị tên bài, cập nhật tên trước khi bắt đầu tải và chốt tên cho lượt tải đó. Nếu bạn tự sửa tên trong Tùy chọn, giữ nguyên tên bạn nhập.
- Nếu không thấy mục bài được chọn hoặc chưa tải lại trang sau nâng cấp, dùng tiêu đề tab dự phòng và ghi rõ nguồn tên trong popup.
- Với playlist nhập tay của bài khác, hãy tự đặt tên phù hợp.
- Thêm content script chỉ đọc tên/ID mục được chọn trên trang `https://*.udemy.com/course/*`; không sửa DOM hoặc đọc cookie, không thêm quyền API.

## Tính năng từ 1.1

- Bấm biểu tượng extension mở **popup**, không mở tab mới.
- Tự chọn và đọc playlist của bài mới nhất khi mở popup. Không cần bấm “Đọc playlist”.
- Ưu tiên đúng **1920×1080 (Full HD)**; nếu có nhiều luồng FHD, chọn bitrate cao nhất. Nếu không có FHD, chọn độ phân giải cao nhất hiện có và ghi rõ trên nút tải. Không nâng độ phân giải giả, không sửa URL để đoán chất lượng.
- Bấm một nút **Tải Full HD**. Tên file tự điền từ bài đang chọn (dự phòng: tiêu đề tab) và sửa được trong Tùy chọn.
- Tự lưu vào thư mục **Udemy** bên trong thư mục tải xuống mặc định, không yêu cầu chọn nơi lưu mỗi lần. Trùng tên tự thêm số, không ghi đè.
- Việc tải nằm trong offscreen document; đóng popup hoặc chuyển tab không dừng tải. Mở lại popup để xem tiến độ và hủy.
- Vẫn có chọn chất lượng khác và nhập Response .m3u8/.txt trong phần Tùy chọn.

## Nâng cấp từ 1.0 / 1.1

1. Đợi các lượt tải cũ kết thúc. Đóng tab giao diện extension 1.0 nếu đang mở.
2. Giải nén ZIP mới.
3. Chép đè **toàn bộ nội dung thư mục `udemy-offline-helper` mới** vào thư mục extension đã cài, để `manifest.json` nằm đúng vị trí cũ. Không chép thêm một lớp thư mục lồng nhau.
4. Mở `chrome://extensions` hoặc `edge://extensions` → tìm **Udemy Offline Helper** → **Reload / Tải lại**. Kiểm tra version **1.1.1**. Chấp nhận quyền bổ sung nếu trình duyệt yêu cầu.
5. Quay lại Udemy, **bắt buộc tải lại trang một lần** để nạp phần đọc tên bài, rồi phát bài.

Nếu không nhớ thư mục cũ: gỡ bản 1.0 rồi dùng **Load unpacked / Tải tiện ích đã giải nén** để chọn thư mục mới. Không để hai bản chạy song song.

## Cài lần đầu

1. Giải nén ZIP và giữ thư mục trên máy.
2. Mở `chrome://extensions` hoặc `edge://extensions`.
3. Bật **Developer mode** → **Load unpacked** → chọn thư mục có `manifest.json`.
4. Ghim biểu tượng extension vào thanh công cụ.
5. Tải lại tab Udemy sau khi cài và phát bài.

## Cách dùng nhanh

**Phát bài → bấm biểu tượng extension → Tải Full HD.**

- Popup tự đọc playlist. Nếu chưa nhận diện, tải lại trang Udemy và phát bài rồi mở popup lại.
- Có thể đóng popup sau khi nút chuyển sang “Đang tải nền”. Không cần giữ tab riêng nào mở.
- Vẫn phải để trình duyệt chạy và máy không ngủ. Không reload/gỡ extension khi đang tải. Chưa hỗ trợ tiếp tục tải dở sau khi tắt trình duyệt.
- Chỉ tải một bài mỗi thời điểm, trên mọi tab. Bài đang tải không tự đổi khi bạn chuyển bài trên Udemy.
- File `.ts` nằm trong thư mục tải xuống mặc định / `Udemy`. Mở bằng VLC: https://www.videolan.org/vlc/.
- Kiểm tra cả hình, tiếng và cuối video; thử mở khi tắt mạng trước khi sử dụng ở điểm trường.
- Chất lượng khác chọn trong **Tùy chọn và nhập playlist**. Mỗi lần đọc bài mới vẫn ưu tiên FHD.
- Nếu chỉ nhận được media playlist 720p mà không có master, extension chỉ biết các luồng đã quan sát được. Chọn 1080p trong trình phát Udemy rồi phát lại hoặc nhập master playlist. Không phải bài nào cũng có FHD.

## Nhập file Response

1. F12 → Network → All → lọc `m3u8` → phát bài.
2. Chọn media playlist có `#EXTINF`, các URL `.ts`, kết thúc bằng `#EXT-X-ENDLIST`.
3. Lưu toàn bộ Response thành `.m3u8` hoặc `.txt`, giữ nguyên tham số ký trên máy bạn.
4. Popup → **Tùy chọn và nhập playlist** → chọn file → **Đọc URL / file** → tải video.
5. Nếu file dùng đường dẫn tương đối, nhập URL của chính playlist vào ô URL. File có URL HTTPS tuyệt đối thì không cần.

File được ưu tiên nếu đồng thời có file và URL. Muốn chỉ dùng URL, bỏ chọn file hoặc mở lại popup. Đừng chia sẻ URL/token còn hiệu lực.

## Giới hạn và lỗi

- Đầu ra **MPEG-TS (.ts)**, không phải MP4. Không lấy phụ đề/tài liệu/bài tập/chứng chỉ.
- Chỉ HLS VOD không mã hóa, audio nằm cùng segment video.
- Không hỗ trợ DRM, AES-128, SAMPLE-AES, fMP4, DASH, byte-range, discontinuity, live stream hoặc audio tách riêng. Khi có khai báo mã hóa, dừng và không lấy khóa.
- Tối đa 512 MiB/bài. Video giữ trong RAM trước khi ghi; cần RAM trống nhiều hơn kích thước video. Bài dài nên chọn chất lượng thấp hơn.
- Lỗi 401/403: link có thể hết hạn hoặc máy chủ từ chối; phát lại bài và lấy playlist mới. Không sửa token/Policy bằng tay.
- Lỗi mạng/429/5xx: thử tối đa 3 lần/đoạn, mỗi request giới hạn 45 giây. Không tạo video thiếu đoạn hoặc segment không phải MPEG-TS.
- Nếu danh sách bài chưa được tải vào DOM, tên lấy từ tiêu đề tab dự phòng. Mở danh sách bài học rồi bấm Làm mới, hoặc tự chỉnh tên.

Nếu đã có FFmpeg, đổi container TS sang MP4 không mã hóa lại:

```powershell
ffmpeg -i "bai-hoc.ts" -c copy -movflags +faststart "bai-hoc.mp4"
```

## Quyền và dữ liệu

- `webRequest`: quan sát URL playlist từ tab Udemy; không chặn/sửa request.
- Host chỉ `https://*.udemy.com/*` và `https://*.udemycdn.com/*`.
- `storage`: session storage cho URL (tối đa 40/tab), tiến độ và ID tải. Không đồng bộ/lưu lịch sử dài hạn. Đóng tab nguồn xóa danh sách URL của tab; bài đã bắt đầu tải vẫn tiếp tục.
- `downloads`: lưu vào Downloads/Udemy, theo dõi và hủy lượt tải.
- **Mới: `offscreen`** — tài liệu ẩn giữ Blob video và tiếp tục tải khi popup đóng; không mở tab mới.
- Không quyền `cookies`, không đọc mật khẩu. Trình duyệt có thể tự kèm cookie khi fetch playlist Udemy theo quy tắc của nó.
- Không analytics, máy chủ riêng, mã CDN hoặc thư viện ngoài. Mã nguồn đầy đủ đi kèm.
- Chỉ dùng với nội dung bạn được phép lưu và sử dụng. Extension không xác định quyền chiếu/phân phối cho lớp học.

## Kiểm thử

Bản 1.1.1 qua **18 kiểm thử tự động**: parser, URL, ưu tiên FHD kể cả có 4K, tách bài mới/cũ, thứ tự đoạn, lỗi/hủy/giới hạn dung lượng, không xuất file thiếu, Blob/lưu file, chạy nền không có popup và mở lại xem tiến độ. Có thêm test tên bài dựa trên các trường HTML đã cung cấp, ID không khớp khi chuyển bài, giữ tên tự đặt và chốt tên khi tải. Test dùng DOM giả lập và Chrome API/network mô phỏng; chưa chạy trên trang thật.

Bản 1.0 đã được người dùng xác nhận hoạt động. Thay đổi popup/offscreen/đọc tên chưa được chạy trong Chrome thật tại môi trường tạo gói (không có Chromium thực thi). Hãy thử một bài ngắn, đóng popup khi đang tải rồi mở lại để kiểm tra lần đầu.

Chạy test với Node.js 22+:

```text
node --test tests/*.test.mjs
```

Tệp chính: `popup.*` (giao diện), `background.js` (nhận diện/điều phối), `offscreen.*` và `engine.mjs` (tải nền), `selection.mjs` (chọn bài/FHD), `lesson-content.js` (đọc tên bài), `network.mjs` (HTTP), `hls.mjs` (playlist/ghép đoạn).

Tài liệu API:
- https://developer.chrome.com/docs/extensions/reference/api/offscreen
- https://developer.chrome.com/docs/extensions/reference/api/runtime
- https://developer.chrome.com/docs/extensions/reference/api/webRequest
- https://developer.chrome.com/docs/extensions/reference/api/downloads
- https://www.rfc-editor.org/rfc/rfc8216
