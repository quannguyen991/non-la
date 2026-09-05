/* ═══════════════════════════════════════════════════════════════
   premium.js — những quán mà giá cao là PHÂN KHÚC, không phải chặt chém

   CÂU HỎI NÓ TRẢ LỜI
   Khách mở menu ra thấy 850.000đ một đĩa. App nói "vượt khoảng thường gặp"
   — đúng, nhưng chưa đủ. Còn một câu hỏi nữa mà app chưa trả lời được:
   *chỗ này vốn đắt, hay mình đang bị hét giá?* Hai tình huống ấy đòi hai
   hành động ngược nhau, và đoán sai theo chiều nào cũng dở: một bên là trả
   tiền cho thứ mình không định mua, bên kia là đi cãi nhau với một nhà hàng
   không làm gì sai.

   VÌ SAO KHÔNG GẮN NHÃN VÀO TỪNG QUÁN
   Cách hiển nhiên là đối chiếu 22 cái tên này với 2.481 quán trong
   eateries.json rồi gắn nhãn "phân khúc cao cấp" lên thẻ quán. Đã thử: chỉ
   4 quán nhận diện chắc chắn được (Morning Glory Original, Anan Saigon,
   Cau Go, Secret Garden). Tên OSM là tên người qua đường gõ vào, không phải
   tên đăng ký: "Gia" khớp với "Mì Quảng Giao Thủy", "Garden" ở Đà Nẵng khớp
   với "Secret Garden 158 Pasteur" ở Quận 1.

   Gắn nhầm nhãn ấy lên một quán có thật là nói sai về một cơ sở kinh doanh
   — đúng loại lỗi mà cả sản phẩm này dựng ra để tránh. Nên bỏ hẳn việc khớp:
   hiện nguyên danh sách, để người đọc tự đối chiếu cái tên trước mặt họ. Bốn
   phần hai mươi hai thì không đáng có một đường mã, mà hai mươi hai cái tên
   đọc được thì đủ dùng.

   ĐÂY KHÔNG PHẢI PHÁN QUYẾT CỦA NÓN LÁ
   Mức giá trong danh sách là mức chính quán hoặc bài hướng dẫn công bố, kèm
   đường dẫn nguồn. App chỉ chép lại và ghi nguồn. Giao diện phải nói rõ điều
   đó, vì một con số tiền đặt cạnh tên một nhà hàng có thật rất dễ đọc thành
   lời buộc tội — và ở đây thì không có lời buộc tội nào cả.
   ═══════════════════════════════════════════════════════════════ */

/**
 * Số tiền đầu tiên trong chuỗi mức giá, để xếp thứ tự.
 *
 * Chuỗi viết theo kiểu người ta đọc chứ không theo một khuôn: "Khoảng
 * 1.200.000–2.500.000đ/người", "690.000đ/người buffet cuối tuần; món lẻ cao
 * hơn local", "US$115–145 food only ≈ 3,000.000–3,800.000đ/người". Nên chỉ
 * bắt cụm số có dấu phân cách nhóm — bỏ qua "115" và "145" của US$ vì chúng
 * không có dấu, và bỏ qua luôn "158" trong "Secret Garden 158 Pasteur".
 *
 * @returns {number} 0 khi không đọc ra số nào — mục ấy xuống cuối, không
 *                   biến mất.
 */
export function bandFloor(band) {
  const m = String(band || "").match(/\d{1,3}(?:[.,]\d{3})+/g);
  if (!m) return 0;
  return Math.min(...m.map((s) => parseInt(s.replace(/[.,]/g, ""), 10)));
}

/**
 * Danh sách quán của một vùng, đắt nhất trước.
 *
 * Xếp theo tiền chứ không theo tên: người đọc đang muốn biết mình sắp bước
 * vào bậc giá nào, và bậc cao nhất là bậc dễ gây bất ngờ nhất. Đây là thứ
 * tự GIÁ, không phải xếp hạng ngon dở — Nón Lá không xếp hạng ngon dở.
 */
export function forZone(doc, zone) {
  const all = doc?.venues || [];
  return all
    .filter((v) => v && v.zone === zone && v.name)
    .sort((a, b) => bandFloor(b.band) - bandFloor(a.band));
}
