import { useEffect, useState } from 'react';
import { motion, useAnimation, useMotionValue, useTransform } from 'framer-motion';
import {
  fetchCatalogs,
  fetchProfile,
  hasLiveSession,
  profileToPayload,
  profileToUiState,
  replaceProfile,
  saveOnboarding,
} from './profileApi';

const assets = {
  bunBo: '/assets/stitch/bun-bo-hue.jpg',
  detail: '/assets/stitch/detail-hero.jpg',
  detailThumb: '/assets/stitch/detail-thumb.jpg',
  pho: '/assets/stitch/pho-bo.jpg',
  comTam: '/assets/stitch/com-tam.jpg',
  mienGa: '/assets/stitch/mien-ga.jpg',
  avatar: '/assets/stitch/profile-avatar.jpg',
};

function Icon({ name, filled = false, className = '' }) {
  return <span className={`material-symbols-outlined ${filled ? 'filled' : ''} ${className}`} aria-hidden="true">{name}</span>;
}

function App() {
  const [screen, setScreen] = useState(() => window.location.hash.replace('#', '') || 'assistant');
  const [toast, setToast] = useState('');

  useEffect(() => {
    const onHashChange = () => setScreen(window.location.hash.replace('#', '') || 'assistant');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (next) => {
    if (next !== screen) window.location.hash = next;
  };

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  };

  const isWizard = screen === 'taste';
  const content = {
    assistant: <AssistantPage navigate={navigate} showToast={showToast} />,
    detail: <DetailPage navigate={navigate} showToast={showToast} />,
    taste: <LiveTastePage navigate={navigate} showToast={showToast} />,
    profile: <LiveProfilePage navigate={navigate} showToast={showToast} />,
    discover: <DiscoverPage navigate={navigate} showToast={showToast} />,
  }[screen] || <AssistantPage navigate={navigate} showToast={showToast} />;

  return <div className="device-shell">
    {!isWizard && screen !== 'detail' && <TopHeader navigate={navigate} />}
    <main className={`screen ${isWizard ? 'wizard-screen' : ''} ${screen === 'detail' ? 'detail-screen' : ''}`}>{content}</main>
    {!isWizard && <BottomNav screen={screen} navigate={navigate} />}
    <div className={`toast ${toast ? 'visible' : ''}`}><Icon name="check_circle" filled />{toast}</div>
  </div>;
}

function TopHeader({ navigate }) {
  return <header className="top-header">
    <button className="logo-lockup" type="button" onClick={() => navigate('assistant')} aria-label="Trang chủ">
      <span className="logo-mark"><Icon name="restaurant" /></span>
      <span><strong>EatWise <em>AI</em></strong><small><Icon name="near_me" /> Cầu Giấy, Hà Nội <Icon name="expand_more" /></small></span>
    </button>
    <div className="header-icons"><button type="button" onClick={() => navigate('discover')} aria-label="Tìm kiếm"><Icon name="search" /></button><button type="button" onClick={() => navigate('profile')} aria-label="Thông báo"><Icon name="notifications" /><i /></button><button className="header-avatar" type="button" onClick={() => navigate('profile')} aria-label="Hồ sơ"><Icon name="person" /></button></div>
  </header>;
}

function BottomNav({ screen, navigate }) {
  const tabs = [['discover', 'explore', 'Khám Phá'], ['detail', 'map', 'Bản Đồ'], ['assistant', 'neurology', 'AI Trợ Lý'], ['profile', 'account_circle', 'Hồ Sơ']];
  return <nav className="bottom-nav"><div>{tabs.map(([id, icon, label]) => <button key={id} className={`${screen === id ? 'active ' : ''}${id === 'assistant' ? 'assistant-tab' : ''}`} type="button" onClick={() => navigate(id)}>{id === 'assistant' ? <span className="assistant-orb"><Icon name={icon} /></span> : <Icon name={icon} />}<span>{label}</span></button>)}</div></nav>;
}

function AssistantPage({ navigate, showToast }) {
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const sendMessage = () => { if (!message.trim()) return; setSent(true); setMessage(''); };
  return <div className="assistant-page">
    <section className="assistant-agent-card"><span className="agent-orb"><Icon name="smart_toy" /></span><div><strong>Trợ lý AI EatWise</strong><span className="online-badge">ONLINE</span><p>Đang đồng bộ Hồ sơ khẩu vị • ...</p></div><span className="agent-model">GPT-4o Agent</span></section>
    <div className="chat-chips"><button type="button" onClick={() => setMessage('Phở bò không hành < 60k')}><Icon name="ramen_dining" /> Phở bò không hành &lt; 60k</button><button type="button" onClick={() => setMessage('Ăn ấm bụng & ít cay')}><Icon name="thermostat" /> Ăn ấm bụng • Ít cay</button></div>
    <div className="chat-thread">
      <div className="user-message">Trời se se lạnh quá, tìm cho tôi tô bún bò Huế đậm vị gần Cầu Giấy, tuyệt đối không hành và không dị ứng hải sản nhé!<small>11:42</small></div>
      <div className="ai-message"><span className="ai-avatar"><Icon name="neurology" /></span><p>Dạ em hiểu ngay! Đã quét 24 quán bún bò quanh bán kính 1.2km, đối chiếu với Taste Profile (tránh hành lá &amp; dị ứng hải sản) của bạn. Món chuẩn vị số 1 lúc này:</p></div>
      {sent && <div className="ai-message follow-up"><span className="ai-avatar"><Icon name="neurology" /></span><p>Em đang lọc lại theo yêu cầu mới của bạn, sẽ ưu tiên quán gần và có ghi chú an toàn rõ ràng.</p></div>}
      <article className="assistant-food-card"><div className="food-image"><img src={assets.bunBo} alt="Bún bò Huế O Xuân" /><span><Icon name="verified" filled /> 98% Khẩu vị trùng khớp</span><div><strong>Bún Bò Huế O Xuân</strong><small>Trần Đăng Ninh, Cầu Giấy • 850m</small></div><b>55.000đ<small>★ 4.8 (820+)</small></b></div><div className="assistant-reason"><Icon name="auto_awesome" /><p><strong>Lý do gợi ý:</strong> Nước dùng ninh xương bò 14 tiếng chuẩn Huế, đồ cay ấm vừa với tiết trời se lạnh. Quán tuân thủ chuẩn quy trình món không hải sản.</p></div><div className="food-actions"><button type="button" onClick={() => navigate('detail')}><Icon name="map" /> Xem trên Map (850m)</button><button type="button" onClick={() => showToast('Đã mở bước đặt món AI')}><Icon name="shopping_cart" /> Đặt món này</button></div></article>
    </div>
    <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); sendMessage(); }}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Nhắn cho EatWise..." /><button type="button" onClick={() => showToast('Tính năng giọng nói đang được chuẩn bị')} aria-label="Nói"><Icon name="mic" /></button><button className="send" type="submit" aria-label="Gửi"><Icon name="arrow_upward" /></button></form>
  </div>;
}

function DetailPage({ navigate, showToast }) {
  const [saved, setSaved] = useState(false);
  return <div className="detail-page-content">
    <div className="detail-topbar"><button type="button" onClick={() => navigate('assistant')} aria-label="Quay lại"><Icon name="arrow_back" /></button><strong>Chi Tiết Món Ăn</strong><div><button type="button" onClick={() => showToast('Đã chia sẻ món ăn')}><Icon name="share" /></button><button className="mini-avatar" type="button" onClick={() => navigate('profile')}><Icon name="person" /></button></div></div>
    <section className="detail-photo"><img src={assets.detail} alt="Bún bò Huế đặc biệt" /><span className="safe-pill"><Icon name="verified_user" filled /> An toàn dị ứng 100% • Không hải sản</span><button className={`heart-button ${saved ? 'saved' : ''}`} type="button" onClick={() => setSaved((value) => !value)}><Icon name="favorite" filled={saved} /></button><span className="detail-price"><strong>55.000đ</strong><del>70.000đ</del></span></section>
    <section className="detail-info"><h1>Bún Bò Huế Đặc Biệt</h1><p>Bò bắp hoa mềm, chả cua que, nước hầm xương ống 12 tiếng</p><div className="detail-metrics"><Metric icon="local_fire_department" value="480" label="Năng lượng kcal" /><Metric icon="local_fire_department" value="🌶️ 🌶️ 🌶️" label="Độ cay 3/5 (Vừa)" /><Metric icon="verified_user" value="Safe+" label="Không ghi hình thô" /></div></section>
    <section className="location-section"><div className="location-heading"><h2><Icon name="explore" /> Vị trí &amp; Quãng đi lân cận</h2><span>Cầu Giấy, Hà Nội</span></div><MapPreview /><div className="route-strip"><span><Icon name="call" /></span><strong>850m • 12 phút đi bộ</strong><button type="button" onClick={() => showToast('Đang mở chỉ đường...')}>Mở chỉ đường <Icon name="arrow_forward" /></button></div></section>
    <button className="sticky-order-button" type="button" onClick={() => navigate('assistant')}><Icon name="shopping_bag" /> Nhờ AI đặt quán <span>−15.000đ Freeship <Icon name="arrow_forward" /></span></button>
  </div>;
}

function Metric({ icon, value, label }) { return <div><Icon name={icon} filled /><strong>{value}</strong><span>{label}</span></div>; }

function MapPreview() { return <div className="map-preview"><div className="map-water water-one" /><div className="map-water water-two" /><div className="map-road map-road-a" /><div className="map-road map-road-b" /><div className="map-road map-road-c" /><small className="map-text text-hanoi">Hanoi</small><small className="map-text text-trung">Trung Kính</small><span className="map-pin user-map-pin"><Icon name="near_me" /></span><span className="map-pin restaurant-map-pin"><Icon name="restaurant" /></span><span className="map-callout user-callout">Nguyễn Sơn 50k ★4.6</span><span className="map-callout restaurant-callout">O Xuân • 55k ★4.8</span><span className="map-callout other-callout">Cô Đỏ 60k ★4.7</span></div>; }

function TastePage({ navigate, showToast }) {
  const [radius, setRadius] = useState('3.5');
  const [likes, setLikes] = useState(['Món nước', 'Đồ cay', 'Ẩm thực Việt']);
  const [allergies, setAllergies] = useState({ seafood: true, peanut: false, lactose: false, gluten: false });
  const options = [['ramen_dining', 'Món nước'], ['local_fire_department', 'Đồ cay'], ['flag', 'Ẩm thực Việt'], ['outdoor_grill', 'Đồ nướng'], ['spa', 'Healthy & Salad'], ['public', 'Hàn Quốc'], ['sushi', 'Nhật Bản'], ['lunch_dining', 'Đậm đà chuẩn vị']];
  const toggleLike = (label) => setLikes((current) => current.includes(label) ? current.filter((item) => item !== label) : [...current, label]);
  return <div className="taste-page"><div className="taste-topline"><div><small>TASTE PROFILE WIZARD</small><strong>Khởi tạo Hồ sơ Vị giác</strong></div><span><i /> Bước 1/3</span></div><section className="match-card"><span className="match-icon"><Icon name="smart_toy" /></span><div><div><strong>EatWise AI Match Engine</strong><b>Độ chính xác 99.4%</b></div><p>Học sâu thói quen ăn uống, tự động loại trừ chất gây dị ứng và tính toán bán kính giao nhanh nóng sốt nhất!</p></div></section><section className="taste-panel"><PanelHead icon="near_me" title="1. Vị trí & Bán kính giao" action={<button type="button" onClick={() => showToast('Đã định vị tại Cầu Giấy')}><Icon name="my_location" /> Định vị tự động</button>} /><div className="address-box"><Icon name="pin_drop" /><div><strong>Số 18 Duy Tân, Cầu Giấy, Hà Nội</strong><span>Tín hiệu GPS chính xác cao • Tòa nhà FPT</span></div></div><div className="radius-line"><span>Bán kính quét quán ngon:</span><b>{radius} km</b></div><input className="range" type="range" min="1" max="10" step="0.5" value={radius} onChange={(event) => setRadius(event.target.value)} /><div className="range-labels"><span>Siêu tốc (1 km)</span><span>Tiêu chuẩn (5 km)</span><span>Mở rộng (10 km)</span></div></section><section className="taste-panel"><PanelHead icon="favorite" title="2. Sở thích ẩm thực" badge={`Đã chọn ${likes.length} món`} /><p className="panel-note">AI sẽ ưu tiên tổng hợp hương vị kích thích khẩu vị của bạn</p><div className="taste-chip-grid">{options.map(([icon, label]) => <button key={label} className={likes.includes(label) ? 'selected' : ''} type="button" onClick={() => toggleLike(label)}><Icon name={icon} /> {label} {likes.includes(label) && <Icon name="check" />}</button>)}</div></section><section className="taste-panel allergy-panel"><PanelHead icon="shield" title="3. Cảnh báo Dị ứng & An toàn" badge={allergies.seafood ? 'KHÓA TUYỆT ĐỐI' : 'ĐÃ TẮT'} />{[['seafood', 'set_meal', 'Hải sản & Giáp xác', 'Tôm, cua, ốc, mực, nước mắm cốt đậm'], ['peanut', 'nutrition', 'Đậu phộng (Lạc)', 'Sốt đậu phộng, dầu đậu phộng ép'], ['lactose', 'water_drop', 'Sữa & Lactose', 'Bơ thực vật, kem béo, phô mai lát'], ['gluten', 'bakery_dining', 'Gluten', 'Bột mì, quẩy chiên giòn, mì trứng']].map(([key, icon, title, note]) => <Toggle key={key} icon={icon} title={title} note={note} active={allergies[key]} danger={key === 'seafood'} onToggle={() => setAllergies((current) => ({ ...current, [key]: !current[key] }))} />)}</section><button className="taste-save" type="button" onClick={() => { showToast('Đã lưu hồ sơ vị giác'); navigate('discover'); }}>Lưu Hồ Sơ &amp; Tiếp Tục <Icon name="arrow_forward" /></button></div>;
}

function PanelHead({ icon, title, badge, action }) { return <div className="panel-head"><div><Icon name={icon} filled /><h2>{title}</h2></div>{badge && <span>{badge}</span>}{action}</div>; }

function Toggle({ icon, title, note, active = false, danger = false, onToggle = () => {} }) {
  const [enabled, setEnabled] = useState(active);
  return <div className={`toggle ${danger ? 'danger' : ''}`}><div><Icon name={icon} /><span><strong>{title}</strong><small>{note}</small></span></div><button className={enabled ? 'on' : ''} type="button" onClick={() => { setEnabled((value) => !value); onToggle(); }} aria-label={`Bật tắt ${title}`}><i /></button></div>;
}

function ProfilePage({ navigate, showToast }) {
  const [tab, setTab] = useState('taste');
  return <div className="profile-page"><section className="profile-card"><div className="profile-head"><img src={assets.avatar} alt="Nguyễn Tuấn Khang" /><div><h1>Nguyễn Tuấn Khang</h1><span>EatWise Gold</span><small>ID: #EW-9821</small></div><button type="button" onClick={() => showToast('Đã mở chỉnh sửa hồ sơ')}><Icon name="edit" /></button></div><div className="profile-stats"><div><Icon name="stars" /><span>Điểm tích lũy<strong>1.420 <small>pts</small></strong></span></div><div><Icon name="savings" /><span>Tiết kiệm AI<strong>340.000đ</strong></span></div></div></section><div className="profile-tabs"><button className={tab === 'taste' ? 'active' : ''} type="button" onClick={() => setTab('taste')}><Icon name="restaurant_menu" /> Hồ Sơ Khẩu Vị</button><button className={tab === 'history' ? 'active' : ''} type="button" onClick={() => setTab('history')}><Icon name="receipt_long" /> Đơn Hàng AI <i /></button></div>{tab === 'taste' ? <ProfileTaste showToast={showToast} /> : <ProfileHistory showToast={showToast} />}</div>;
}

function ProfileTaste({ showToast }) { return <div className="profile-sections"><section className="profile-panel"><PanelHead icon="shield" title="Khóa Dị Ứng (Allergies Guard)" /><p className="profile-panel-note">AI từ chối quét &amp; tự động chặn các món chứa chất này</p><div className="profile-toggles"><Toggle icon="set_meal" title="Hải sản & Giáp xác" note="Tôm, cua, ốc, mực, nước mắm cốt đậm" active danger /><Toggle icon="nutrition" title="Đậu phộng (Lạc)" note="Sốt đậu phộng, dầu đậu phộng ép" /><Toggle icon="water_drop" title="Sữa & Lactose" note="Bơ thực vật, kem béo, phô mai lát" /><Toggle icon="bakery_dining" title="Gluten" note="Bột mì, quẩy chiên giòn, mì trứng" /></div></section><section className="profile-panel compact-panel"><PanelHead icon="edit_note" title="Tự Động Dặn Quán (Auto Chef Notes)" /><Toggle icon="nature" title="Luôn tự dặn: Không hành lá" active /><Toggle icon="local_fire_department" title="Không ăn cay vượt mức 3 (Ít cay)" active /></section><button className="profile-action orange" type="button" onClick={() => showToast('Khởi động AI Wizard khảo sát khẩu vị...')}><Icon name="magic_button" /> Cập Nhật Lại Khẩu Vị Với AI Wizard</button></div>; }

function ProfileHistory({ showToast }) { return <div className="profile-sections"><section className="monthly-card"><Icon name="smart_toy" /><div><strong>Báo cáo Vệ Tinh AI Tháng Này</strong><p>AI đã giúp bạn tiết kiệm <b>125.000đ</b> và ngăn chặn thành công <b>3 lần nguy cơ</b> tiếp xúc dị ứng hải sản.</p></div></section><HistoryCard image={assets.bunBo} title="Bún Bò Huế Đặc Biệt" restaurant="Bún Bò O Xuân - 107 Trung Kính" price="58.000đ" note="AI đã tự note: Không hành & Nước lèo ninh bò thuần túy" onAction={() => showToast('Đã đặt lại đơn Bún Bò Huế Đặc Biệt!')} /><HistoryCard image={assets.pho} title="Phở Bò Tái Lăn Hà Nội" restaurant="Phở Bát Đàn - Cầu Giấy" price="45.000đ" note="AI tối ưu Voucher: Đã tự động áp mã độc quyền -20.000đ" onAction={() => showToast('Đã thêm Phở Bò Tái Lăn vào giỏ!')} /></div>; }

function HistoryCard({ image, title, restaurant, price, note, onAction }) { return <article className="history-card"><div className="history-status">✓ Vừa hoàn thành <strong>{price}</strong></div><div className="history-content"><img src={image} alt={title} /><div><h3>{title}</h3><p><Icon name="storefront" /> {restaurant}</p><span><Icon name="smart_toy" /> {note}</span></div></div><div className="history-bottom"><small><Icon name="credit_score" /> Thanh toán tự động • Apple Pay</small><button type="button" onClick={onAction}>Đặt lại đơn này</button></div></article>; }

function DiscoverPage({ navigate, showToast }) {
  const [cards, setCards] = useState([
    { id: 4, img: assets.mienGa, title: 'Miến Gà Ta Nước Dùng Thanh', price: '45.000đ', meta: 'Gà Ta Quán • 600m', reason: 'Gà đồi thả vườn, nước dùng không phụ gia.' },
    { id: 3, img: assets.comTam, title: 'Cơm Tấm Sườn Bì Chả Nướng', price: '50.000đ', meta: 'Cơm Tấm Ba Ghiền • 1.8km', reason: 'Sườn ướp mật ong nướng than củi tuyệt hảo.' },
    { id: 2, img: assets.pho, title: 'Phở Bò Tái Lăn Hà Nội', price: '60.000đ', meta: 'Phở Gia Truyền Bát Đàn • 1.2km', reason: 'Cam kết chuẩn ghi chú "Không Hành".' },
    { id: 1, img: assets.bunBo, title: 'Bún Bò Huế Đặc Biệt Nước Trong', price: '55.000đ', meta: 'Bún Bò O Xuân • 850m (7 phút đi xe)', reason: 'Thơm cay tự nhiên, quán có tùy chọn bỏ sạch hành lá & 100% không hải sản theo hồ sơ của bạn.' }
  ]);
  const [likedDishes, setLikedDishes] = useState([]);

  const handleSwipe = (direction, card) => {
    setCards((prev) => prev.filter(c => c.id !== card.id));
    if (direction === 'right') {
      showToast(`Đã lưu ${card.title}`);
      setLikedDishes((prev) => [card, ...prev]);
    } else {
      showToast('Đã bỏ qua');
    }
  };

  return <div className="discover-swipe-layout">
    <div className="discover-swipe-main">
      <div className="discover-swipe-header">
        <h1>Khám Phá Món Ngon</h1>
        <p>Vuốt phải để thích, trái để bỏ qua</p>
      </div>
      <div className="swipe-card-container">
        {cards.length === 0 ? (
          <div className="empty-state">
             <div className="empty-icon"><Icon name="restaurant_menu" /></div>
             <h2>Đã hết món gợi ý!</h2>
             <p>AI đang tìm kiếm thêm món mới.</p>
             <button onClick={() => window.location.reload()}>Khám phá lại</button>
          </div>
        ) : (
          cards.map((card, index) => {
             const isTop = index === cards.length - 1;
             // calculate stack offset for background cards
             const stackOffset = cards.length - 1 - index;
             return <SwipeCard key={card.id} card={card} isTop={isTop} stackOffset={stackOffset} onSwipe={handleSwipe} navigate={navigate} />
          })
        )}
      </div>
    </div>

    <div className="discover-swipe-sidebar">
      <h2>Các món đã thích ({likedDishes.length})</h2>
      <div className="liked-list">
         {likedDishes.length === 0 && <p className="text-muted">Bạn chưa thích món nào. Vuốt phải thẻ món ăn để thêm vào đây nhé!</p>}
         {likedDishes.map(d => (
           <div key={d.id} className="liked-item">
             <img src={d.img} alt={d.title}/>
             <div className="liked-info">
               <h4>{d.title}</h4>
               <span>{d.price}</span>
             </div>
           </div>
         ))}
      </div>
    </div>
  </div>;
}

function SwipeCard({ card, isTop, stackOffset, onSwipe, navigate }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [0, -100], [0, 1]);
  const dragControls = useAnimation();

  const handleDragEnd = (event, info) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;
    if (offset > 100 || velocity > 500) {
      dragControls.start({ x: window.innerWidth, transition: { duration: 0.3 } }).then(() => onSwipe('right', card));
    } else if (offset < -100 || velocity < -500) {
      dragControls.start({ x: -window.innerWidth, transition: { duration: 0.3 } }).then(() => onSwipe('left', card));
    } else {
      dragControls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 20 } });
    }
  };

  const scale = Math.max(1 - (stackOffset * 0.05), 0.8);
  const translateY = stackOffset * -15;

  return (
    <motion.div
      className="tinder-card-modern"
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        opacity: isTop ? 1 : 1, // Opacity handling removed from card base, managed by drag
        scale: isTop ? 1 : scale,
        y: isTop ? 0 : translateY,
        zIndex: isTop ? 10 : 10 - stackOffset,
        pointerEvents: isTop ? 'auto' : 'none'
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      animate={dragControls}
      whileTap={isTop ? { cursor: "grabbing" } : {}}
    >
      <motion.div className="tinder-badge like-badge" style={{ opacity: isTop ? likeOpacity : 0 }}>LIKE</motion.div>
      <motion.div className="tinder-badge nope-badge" style={{ opacity: isTop ? nopeOpacity : 0 }}>NOPE</motion.div>

      <img src={card.img} alt={card.title} draggable="false" />
      <div className="card-gradient"></div>

      <div className="tinder-card-content">
        <div className="card-info">
          <h2>{card.title}</h2>
          <span className="price">{card.price}</span>
        </div>
        <p className="meta"><Icon name="storefront" /> {card.meta}</p>
        <div className="reason-box">
          <Icon name="neurology" />
          <p><strong>Lý do gợi ý:</strong> {card.reason}</p>
        </div>
        <div className="card-actions">
           <button className="btn-details" onClick={() => navigate('detail')}><Icon name="info" /> Xem chi tiết</button>
           <button className="btn-order" onClick={() => navigate('assistant')}><Icon name="smart_toy" /> AI Đặt ngay</button>
        </div>
      </div>
    </motion.div>
  );
}

const liveCuisineOptions = [
  ['VIETNAMESE', 'Ẩm thực Việt'],
  ['KOREAN', 'Hàn Quốc'],
  ['JAPANESE', 'Nhật Bản'],
  ['CHINESE', 'Trung Quốc'],
  ['THAI', 'Thái Lan'],
  ['ITALIAN', 'Ý'],
];

const liveAllergyOptions = [
  ['seafood', 'SHELLFISH', 'set_meal', 'Hải sản & Giáp xác', 'Tôm, cua, ốc, mực'],
  ['peanut', 'PEANUT', 'nutrition', 'Đậu phộng (Lạc)', 'Sốt đậu phộng, dầu đậu phộng ép'],
  ['lactose', 'MILK', 'water_drop', 'Sữa & Lactose', 'Bơ thực vật, kem béo, phô mai lát'],
  ['gluten', 'WHEAT_GLUTEN', 'bakery_dining', 'Gluten', 'Bột mì, quẩy chiên giòn, mì trứng'],
];

function LiveTastePage({ navigate, showToast }) {
  const live = hasLiveSession();
  const [profile, setProfile] = useState(null);
  const [catalogs, setCatalogs] = useState({ allergens: [], dietaryRestrictions: [], cuisines: [] });
  const [radius, setRadius] = useState('3.5');
  const [likes, setLikes] = useState(['Món nước', 'Đồ cay', 'Ẩm thực Việt']);
  const [allergies, setAllergies] = useState({ seafood: true, peanut: false, lactose: false, gluten: false });
  const [loading, setLoading] = useState(live);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!live) return undefined;
    let cancelled = false;
    Promise.all([fetchProfile(), fetchCatalogs()])
      .then(([profileResponse, catalogResponse]) => {
        if (cancelled) return;
        const nextProfile = profileResponse.data.profile;
        const uiState = profileToUiState(nextProfile);
        const cuisineLabels = liveCuisineOptions
          .filter(([code]) => uiState.likes.has(code))
          .map(([, label]) => label);
        const allergyCodes = uiState.allergies;
        setProfile(nextProfile);
        setCatalogs(catalogResponse);
        if (nextProfile) {
          setRadius(uiState.radius);
          setLikes(cuisineLabels.length > 0 ? cuisineLabels : []);
          setAllergies({
            seafood: allergyCodes.has('SHELLFISH') || allergyCodes.has('FISH'),
            peanut: allergyCodes.has('PEANUT'),
            lactose: allergyCodes.has('MILK'),
            gluten: allergyCodes.has('WHEAT_GLUTEN'),
          });
        }
      })
      .catch((apiError) => {
        if (!cancelled) setError(apiError.message || 'Không tải được hồ sơ vị giác');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [live]);

  const toggleLike = (label) => setLikes((current) => current.includes(label) ? current.filter((item) => item !== label) : [...current, label]);

  const buildPayload = () => {
    const availableCuisines = new Set(catalogs.cuisines.map((item) => item.code));
    const selectedCuisines = liveCuisineOptions
      .filter(([, label]) => likes.includes(label))
      .map(([code]) => code)
      .filter((code) => !live || availableCuisines.has(code))
      .map((code) => ({ code, preferenceScore: 100 }));
    const availableAllergens = new Set(catalogs.allergens.map((item) => item.code));
    const selectedAllergies = liveAllergyOptions
      .filter(([key]) => allergies[key])
      .map(([, code]) => code)
      .filter((code) => !live || availableAllergens.has(code))
      .map((code) => ({ code, severity: 'SEVERE', notes: null }));

    return profileToPayload(profile, {
      maxDistanceMeters: Math.round(Number(radius) * 1000),
      allergies: selectedAllergies,
      dietaryRestrictions: [],
      cuisinePreferences: selectedCuisines,
    });
  };

  const save = async () => {
    if (!live) {
      showToast('Đã lưu hồ sơ vị giác ở chế độ xem trước');
      navigate('discover');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await saveOnboarding(buildPayload());
      setProfile(response.data.profile);
      showToast('Đã đồng bộ hồ sơ vị giác');
      navigate('discover');
    } catch (apiError) {
      setError(apiError.message || 'Không thể lưu hồ sơ vị giác');
    } finally {
      setSaving(false);
    }
  };

  return <div className="taste-page">
    <div className="taste-topline"><div><small>TASTE PROFILE WIZARD</small><strong>Khởi tạo Hồ sơ Vị giác</strong></div><span><i /> Bước 1/3</span></div>
    <section className="match-card"><span className="match-icon"><Icon name="smart_toy" /></span><div><div><strong>EatWise AI Match Engine</strong><b>Độ chính xác 99.4%</b></div><p>Học sâu thói quen ăn uống, tự động loại trừ chất gây dị ứng và tính toán bán kính giao nhanh nóng sốt nhất!</p></div></section>
    {loading && <div className="api-status loading"><Icon name="sync" /> Đang tải hồ sơ và catalog an toàn...</div>}
    {error && <div className="api-status error"><Icon name="error" /> {error}</div>}
    <section className="taste-panel"><PanelHead icon="near_me" title="1. Vị trí & Bán kính giao" action={<button type="button" onClick={() => showToast('Đã định vị tại Cầu Giấy')}><Icon name="my_location" /> Định vị tự động</button>} /><div className="address-box"><Icon name="pin_drop" /><div><strong>Số 18 Duy Tân, Cầu Giấy, Hà Nội</strong><span>Tín hiệu GPS chính xác cao • Tòa nhà FPT</span></div></div><div className="radius-line"><span>Bán kính quét quán ngon:</span><b>{radius} km</b></div><input className="range" type="range" min="1" max="10" step="0.5" value={radius} onChange={(event) => setRadius(event.target.value)} /><div className="range-labels"><span>Siêu tốc (1 km)</span><span>Tiêu chuẩn (5 km)</span><span>Mở rộng (10 km)</span></div></section>
    <section className="taste-panel"><PanelHead icon="favorite" title="2. Sở thích ẩm thực" badge={`Đã chọn ${likes.length} món`} /><p className="panel-note">AI sẽ ưu tiên tổng hợp hương vị kích thích khẩu vị của bạn</p><div className="taste-chip-grid">{[['ramen_dining', 'Món nước'], ['local_fire_department', 'Đồ cay'], ...liveCuisineOptions.map(([code, label], index) => [['flag', 'Ẩm thực Việt'], ['public', 'Hàn Quốc'], ['sushi', 'Nhật Bản'], ['lunch_dining', 'Trung Quốc'], ['outdoor_grill', 'Thái Lan'], ['local_pizza', 'Ý']][index] ? [[['flag', 'Ẩm thực Việt'], ['public', 'Hàn Quốc'], ['sushi', 'Nhật Bản'], ['lunch_dining', 'Trung Quốc'], ['outdoor_grill', 'Thái Lan'], ['local_pizza', 'Ý']][index][0], label] : ['flag', label])].map(([icon, label]) => <button key={label} className={likes.includes(label) ? 'selected' : ''} type="button" onClick={() => toggleLike(label)}><Icon name={icon} /> {label} {likes.includes(label) && <Icon name="check" />}</button>)}</div></section>
    <section className="taste-panel allergy-panel"><PanelHead icon="shield" title="3. Cảnh báo Dị ứng & An toàn" badge={allergies.seafood ? 'KHÓA TUYỆT ĐỐI' : 'ĐÃ TẮT'} />{liveAllergyOptions.map(([key, code, icon, title, note]) => <LiveToggle key={key} icon={icon} title={title} note={note} active={allergies[key]} danger={key === 'seafood'} onToggle={() => setAllergies((current) => ({ ...current, [key]: !current[key] }))} />)}</section>
    <button className="taste-save" type="button" disabled={saving || loading} onClick={save}>{saving ? <><Icon name="sync" /> Đang đồng bộ...</> : <>Lưu Hồ Sơ &amp; Tiếp Tục <Icon name="arrow_forward" /></>}</button>
  </div>;
}

function LiveToggle({ icon, title, note, active = false, danger = false, onToggle }) {
  return <div className={`toggle ${danger ? 'danger' : ''}`}><div><Icon name={icon} /><span><strong>{title}</strong><small>{note}</small></span></div><button className={active ? 'on' : ''} type="button" onClick={onToggle} aria-label={`Bật tắt ${title}`}><i /></button></div>;
}

function LiveProfilePage({ navigate, showToast }) {
  const [tab, setTab] = useState('taste');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(hasLiveSession());
  const [error, setError] = useState('');

  useEffect(() => {
    if (!hasLiveSession()) return undefined;
    let cancelled = false;
    fetchProfile().then((response) => {
      if (!cancelled) setProfile(response.data.profile);
    }).catch((apiError) => {
      if (!cancelled) setError(apiError.message || 'Không tải được hồ sơ');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return <div className="profile-page"><section className="profile-card"><div className="profile-head"><img src={assets.avatar} alt="Nguyễn Tuấn Khang" /><div><h1>Nguyễn Tuấn Khang</h1><span>EatWise Gold</span><small>ID: #EW-9821</small></div><button type="button" onClick={() => showToast('Đã mở chỉnh sửa hồ sơ')}><Icon name="edit" /></button></div><div className="profile-stats"><div><Icon name="stars" /><span>Điểm tích lũy<strong>1.420 <small>pts</small></strong></span></div><div><Icon name="savings" /><span>Tiết kiệm AI<strong>340.000đ</strong></span></div></div></section><div className="profile-tabs"><button className={tab === 'taste' ? 'active' : ''} type="button" onClick={() => setTab('taste')}><Icon name="restaurant_menu" /> Hồ Sơ Khẩu Vị</button><button className={tab === 'history' ? 'active' : ''} type="button" onClick={() => setTab('history')}><Icon name="receipt_long" /> Đơn Hàng AI <i /></button></div>{loading && <div className="api-status loading"><Icon name="sync" /> Đang tải hồ sơ thật...</div>}{error && <div className="api-status error"><Icon name="error" /> {error}</div>}{tab === 'taste' ? <LiveProfileTaste profile={profile} onProfileChange={setProfile} showToast={showToast} /> : <ProfileHistory showToast={showToast} />}</div>;
}

function LiveProfileTaste({ profile, onProfileChange, showToast }) {
  const live = hasLiveSession();
  const [activeCodes, setActiveCodes] = useState(() => new Set((profile?.allergies || []).map((item) => item.code)));

  useEffect(() => {
    setActiveCodes(new Set((profile?.allergies || []).map((item) => item.code)));
  }, [profile]);

  const toggleRemoteAllergy = async (code) => {
    const nextCodes = new Set(activeCodes);
    if (nextCodes.has(code)) nextCodes.delete(code); else nextCodes.add(code);
    setActiveCodes(nextCodes);
    if (!live) return;
    try {
      const allergies = Array.from(nextCodes).map((itemCode) => ({ code: itemCode, severity: 'SEVERE', notes: null }));
      const response = await replaceProfile(profileToPayload(profile, { allergies }));
      onProfileChange(response.data.profile);
      showToast('Đã cập nhật khóa dị ứng');
    } catch (apiError) {
      setActiveCodes(new Set((profile?.allergies || []).map((item) => item.code)));
      showToast(apiError.message || 'Không thể cập nhật khóa dị ứng');
    }
  };

  return <div className="profile-sections"><section className="profile-panel"><PanelHead icon="shield" title="Khóa Dị Ứng (Allergies Guard)" /><p className="profile-panel-note">AI từ chối quét &amp; tự động chặn các món chứa chất này</p><div className="profile-toggles">{liveAllergyOptions.map(([key, code, icon, title, note]) => <LiveToggle key={key} icon={icon} title={title} note={note} active={activeCodes.has(code)} danger={key === 'seafood'} onToggle={() => toggleRemoteAllergy(code)} />)}</div></section><section className="profile-panel compact-panel"><PanelHead icon="edit_note" title="Tự Động Dặn Quán (Auto Chef Notes)" /><LiveToggle icon="nature" title="Luôn tự dặn: Không hành lá" active /><LiveToggle icon="local_fire_department" title="Không ăn cay vượt mức 3 (Ít cay)" active /></section><button className="profile-action orange" type="button" onClick={() => showToast('Khởi động AI Wizard khảo sát khẩu vị...')}><Icon name="magic_button" /> Cập Nhật Lại Khẩu Vị Với AI Wizard</button></div>;
}

export default App;
