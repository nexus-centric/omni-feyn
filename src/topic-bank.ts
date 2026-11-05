// Vietnamese prompt bank for 1-minute reflex practice. Original prompts written for this app.
export interface BankCategory { id: string; name: string; prompts: string[]; }

export const TOPIC_BANK: BankCategory[] = [
  { id: 'ban-than', name: 'Bản thân & thói quen', prompts: [
    'Một thói quen nhỏ đã thay đổi cuộc sống của bạn', 'Bạn sẽ dạy đứa trẻ 10 tuổi kỹ năng gì đầu tiên', 'Dậy sớm có thật sự giúp bạn thành công hơn',
    'Điều bạn ước mình biết sớm hơn 5 năm', 'Thất bại đáng nhớ nhất và bài học rút ra', 'Nên theo đuổi đam mê hay theo đuổi thứ mình giỏi',
    'Cách bạn nạp lại năng lượng sau một tuần mệt mỏi', 'Kỷ luật hay động lực quan trọng hơn', 'Một quyết định khó bạn từng đưa ra',
    'Nói "không" có phải là một kỹ năng', 'Bạn đo sự tiến bộ của bản thân bằng cách nào', 'Có nên lập kế hoạch cho cả năm',
    'Điều gì khiến bạn trì hoãn nhiều nhất', 'Một cuốn sách thay đổi cách bạn nghĩ', 'Sống tối giản có hợp với người Việt',
  ] },
  { id: 'cong-nghe', name: 'Công nghệ', prompts: [
    'AI sẽ thay đổi công việc của bạn như thế nào trong 5 năm tới', 'Mã nguồn mở có thực sự miễn phí', 'Có nên cấm điện thoại trong lớp học',
    'Điện toán đám mây giải thích cho bà của bạn', 'Mạng xã hội kết nối hay chia rẽ con người', 'Quyền riêng tư dữ liệu có còn tồn tại',
    'Xe điện có phải tương lai giao thông Việt Nam', 'Học lập trình có cần thiết cho mọi người', 'Tự động hoá: kẻ thù hay đồng minh của người lao động',
    'Thanh toán không tiền mặt ở Việt Nam: lợi và hại', 'Làm sao nhận biết tin giả trên mạng', 'Thuật toán gợi ý đang định hình sở thích của bạn ra sao',
    'Có nên để trẻ em dùng máy tính bảng từ sớm', 'DevOps là gì, giải thích trong một phút', 'Tại sao phần mềm luôn có lỗi',
  ] },
  { id: 'kinh-te', name: 'Kinh tế & tiền bạc', prompts: [
    'Lạm phát ảnh hưởng đến ví tiền của bạn thế nào', 'Có nên mua nhà khi còn trẻ', 'Tiết kiệm hay đầu tư trước',
    'Vì sao giá vàng ở Việt Nam thường cao hơn thế giới', 'Làm thêm nghề tay trái: nên hay không', 'Tiền có mua được hạnh phúc',
    'Thương mại điện tử đang thay đổi chợ truyền thống', 'Mức lương có phải yếu tố quan trọng nhất khi chọn việc', 'Thẻ tín dụng: công cụ hay cái bẫy',
    'Kinh tế chia sẻ (Grab, Airbnb) có công bằng với người lao động', 'Thuế nên đánh vào thu nhập hay tiêu dùng', 'Khởi nghiệp hay đi làm thuê',
    'Vì sao các nước lại tranh chấp thương mại', 'Du lịch giá rẻ có làm hại điểm đến', 'Có nên dạy tài chính cá nhân ở trường phổ thông',
  ] },
  { id: 'xa-hoi', name: 'Xã hội', prompts: [
    'Áp lực đồng trang lứa ở người trẻ Việt', 'Có nên kết hôn trước 30 tuổi', 'Người trẻ có nên rời thành phố lớn về quê',
    'Văn hoá xếp hàng ở nơi công cộng', 'Ngày càng nhiều người sống một mình: tốt hay xấu', 'Mạng xã hội và văn hoá "sống ảo"',
    'Sống chung với bố mẹ khi đã đi làm', 'Bình đẳng giới trong việc nhà', 'Có nên cho con đi học thêm nhiều',
    'Vì sao người Việt thích tụ tập', 'Tình nguyện có nên là bắt buộc với học sinh', 'Lòng tốt có bị lợi dụng',
    'Từ thiện công khai hay âm thầm', 'Khoảng cách thế hệ trong gia đình', 'Ùn tắc giao thông: lỗi của ai',
  ] },
  { id: 'giao-duc', name: 'Giáo dục & học tập', prompts: [
    'Học để thi hay học để biết', 'Bằng đại học còn quan trọng không', 'Tự học có thay thế được trường lớp',
    'Cách học một kỹ năng mới trong 30 ngày', 'Tiếng Anh có nên là ngôn ngữ thứ hai chính thức', 'Điểm số có phản ánh năng lực',
    'Đọc sách giấy hay sách điện tử', 'Vì sao chúng ta quên những gì đã học', 'Phương pháp Feynman là gì',
    'Có nên du học sớm', 'Giáo viên giỏi là người như thế nào', 'Học nhóm hay học một mình',
    'Trẻ em có nên được chơi nhiều hơn học', 'Thi cử có làm học sinh sợ sai', 'Làm sao để đặt câu hỏi hay',
  ] },
  { id: 'moi-truong', name: 'Môi trường & sức khoẻ', prompts: [
    'Biến đổi khí hậu ảnh hưởng đến Việt Nam ra sao', 'Có nên cấm túi ni lông', 'Ô nhiễm không khí ở Hà Nội: ai chịu trách nhiệm',
    'Ăn chay có tốt cho hành tinh', 'Ngủ đủ giấc quan trọng thế nào', 'Thể dục 20 phút mỗi ngày có đủ',
    'Sức khoẻ tinh thần nơi công sở', 'Thực phẩm bẩn: người tiêu dùng làm được gì', 'Năng lượng mặt trời trên mái nhà',
    'Du lịch xanh có thật hay chỉ là quảng cáo', 'Có nên đi bộ hoặc xe đạp đi làm', 'Đồ ăn nhanh và giới trẻ',
    'Phân loại rác tại nguồn: vì sao khó', 'Nghiện điện thoại có phải bệnh', 'Sống chậm giữa thành phố',
  ] },
  { id: 'the-gioi', name: 'Thế giới & lịch sử', prompts: [
    'Một sự kiện lịch sử bạn muốn được chứng kiến', 'Toàn cầu hoá có lợi cho ai', 'Liên minh châu Âu đang đối mặt điều gì',
    'Vì sao các đế chế sụp đổ', 'Văn hoá Hàn Quốc lan toả thế nào', 'Việt Nam nên học gì từ Nhật Bản',
    'Di cư và người lao động Việt ở nước ngoài', 'Bài học từ đại dịch COVID-19', 'Ngôn ngữ có quyết định cách ta suy nghĩ',
    'Thành phố nào bạn muốn sống nhất và vì sao', 'Có nên giữ lại các công trình cũ', 'Năng lượng hạt nhân: an toàn hay nguy hiểm',
    'Chiến tranh thông tin thời mạng xã hội', 'Vì sao bản đồ thế giới bị "méo"', 'Đổi Mới 1986 đã thay đổi Việt Nam ra sao',
  ] },
  { id: 'cong-viec', name: 'Công việc & sự nghiệp', prompts: [
    'Làm việc từ xa hay lên văn phòng', 'Nhảy việc nhiều có xấu', 'Sếp giỏi khác sếp tồi ở điểm nào',
    'Cách trình bày một ý tưởng trong 60 giây', 'Họp nhiều có phải dấu hiệu làm việc kém', 'Làm sao xử lý xung đột với đồng nghiệp',
    'Tuần làm việc 4 ngày có khả thi', 'Kỹ năng mềm hay kỹ năng chuyên môn', 'Thời điểm nên xin tăng lương',
    'Có nên làm việc cho công ty khởi nghiệp', 'Cân bằng công việc và cuộc sống có thật', 'Một lỗi sai trong công việc dạy bạn điều gì',
    'Tự động hoá công việc lặp lại của bạn', 'Viết tài liệu kỹ thuật có quan trọng', 'Chuyên sâu một lĩnh vực hay biết nhiều thứ',
  ] },
];

export function randomPrompt(categoryId: string | 'all', avoid?: string): { prompt: string; category: BankCategory } {
  const cats = categoryId === 'all' ? TOPIC_BANK : TOPIC_BANK.filter((c) => c.id === categoryId);
  const pool = cats.flatMap((c) => c.prompts.map((p) => ({ prompt: p, category: c }))).filter((x) => x.prompt !== avoid);
  return pool[Math.floor(Math.random() * pool.length)];
}
