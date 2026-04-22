package domain

import "time"

// Notice는 시스템 공지사항 정보를 나타냅니다.
// 중요 공지, 점검 안내 등을 사용자에게 알리는 용도로 사용됩니다.
type Notice struct {
	ID        int       `gorm:"primaryKey;column:Id" json:"id"`
	Title     string    `gorm:"column:Title;size:100" json:"title"`                 // 공지 제목
	Content   string    `gorm:"column:Content;type:nvarchar(2000)" json:"content"`  // 공지 내용 (최대 2000자)
	IsActive  bool      `gorm:"index;column:IsActive;default:true" json:"isActive"` // 노출 여부
	ViewCount int       `gorm:"column:ViewCount;default:0" json:"viewCount"`        // 조회수
	CreatedAt time.Time `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`   // 등록일
	UpdatedAt time.Time `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`   // 수정일
}

// TableName은 GORM에서 사용할 테이블 이름을 반환합니다.
func (Notice) TableName() string { return "Notices" }

// Faq는 자주 묻는 질문(Frequently Asked Questions) 정보를 나타냅니다.
// 카테고리별로 분류하여 사용자에게 제공됩니다.
type Faq struct {
	ID           int       `gorm:"primaryKey;column:Id" json:"id"`
	Question     string    `gorm:"column:Question;size:200" json:"question"`           // 질문 내용
	Answer       string    `gorm:"column:Answer;type:nvarchar(max)" json:"answer"`     // 답변 내용
	Category     string    `gorm:"index;column:Category;size:20" json:"category"`      // FAQ 카테고리 (예: 결제, 환불, 계정)
	Order        int       `gorm:"column:Order;default:99" json:"order"`               // 출력 순서 (낮을수록 상단 노출)
	IsActive     bool      `gorm:"index;column:IsActive;default:true" json:"isActive"` // 노출 여부
	HelpfulCount int       `gorm:"column:HelpfulCount;default:0" json:"helpfulCount"`  // '도움이 되었어요' 클릭 수
	CreatedAt    time.Time `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`   // 등록일
	UpdatedAt    time.Time `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`   // 수정일
}

// TableName은 GORM에서 사용할 테이블 이름을 반환합니다.
func (Faq) TableName() string { return "Faqs" }

// Event는 이벤트 및 프로모션 정보를 나타냅니다.
// 기간 한정 할인, 참여 이벤트 등을 관리합니다.
type Event struct {
	ID          int       `gorm:"primaryKey;column:Id" json:"id"`
	Title       string    `gorm:"column:Title;size:100" json:"title"`                       // 이벤트 제목
	Description string    `gorm:"column:Description;type:nvarchar(500)" json:"description"` // 상세 설명 (최대 500자)
	ImageUrl    *string   `gorm:"column:ImageUrl;size:300" json:"imageUrl"`                 // 이벤트 대표 이미지 URL
	StartDate   time.Time `gorm:"column:StartDate" json:"startDate"`                        // 이벤트 시작 일시
	EndDate     time.Time `gorm:"column:EndDate" json:"endDate"`                            // 이벤트 종료 일시
	IsActive    bool      `gorm:"index;column:IsActive;default:true" json:"isActive"`       // 노출 여부
	IsFeatured  bool      `gorm:"column:IsFeatured;default:false" json:"isFeatured"`        // 메인 상단 노출 여부
	ViewCount   int       `gorm:"column:ViewCount;default:0" json:"viewCount"`              // 조회수
	CreatedAt   time.Time `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`         // 등록일
	UpdatedAt   time.Time `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`         // 수정일
}

// TableName은 GORM에서 사용할 테이블 이름을 반환합니다.
func (Event) TableName() string { return "Events" }

// Inquiry는 사용자의 1:1 문의 정보를 나타냅니다.
// 사용자가 질문을 남기고 관리자가 답변을 달아주는 프로세스로 진행됩니다.
type Inquiry struct {
	ID         int        `gorm:"primaryKey;column:Id" json:"id"`
	UserID     int        `gorm:"index;column:UserId;index:IX_Inquiries_UserId_Status" json:"userId"`                           // 문의 작성자 ID
	User       User       `gorm:"foreignKey:UserID" json:"user,omitempty"`                                                      // 작성자 정보
	Category   string     `gorm:"column:Category;size:20" json:"category"`                                                      // 문의 분류
	Subject    string     `gorm:"column:Subject;size:100" json:"subject"`                                                       // 제목
	Content    string     `gorm:"column:Content;type:nvarchar(200)" json:"content"`                                             // 내용 (최대 200자)
	Status     string     `gorm:"index;column:Status;default:'PENDING';size:10;index:IX_Inquiries_UserId_Status" json:"status"` // 상태: PENDING(대기), ANSWERED(완료)
	Answer     *string    `gorm:"column:Answer;type:nvarchar(max)" json:"answer"`                                               // 관리자 답변 내용
	AnsweredAt *time.Time `gorm:"column:AnsweredAt" json:"answeredAt"`                                                          // 답변 등록 일시
	AnsweredBy *int       `gorm:"column:AnsweredBy" json:"answeredBy"`                                                          // 답변 관리자 ID
	CreatedAt  time.Time  `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`                                             // 문의 일시
	UpdatedAt  time.Time  `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`                                             // 수정 일시
}

// TableName은 GORM에서 사용할 테이블 이름을 반환합니다.
func (Inquiry) TableName() string { return "Inquiries" }

// Policy는 이용약관, 개인정보처리방침 등 법적 고지 문서를 나타냅니다.
// 버전 관리를 통해 과거 정책 이력을 보관할 수 있습니다.
type Policy struct {
	ID        int       `gorm:"primaryKey;column:Id" json:"id"`
	Type      string    `gorm:"index;column:Type;size:20" json:"type"`                 // 문서 유형: TERMS(이용약관), PRIVACY(개인정보), MARKETING(마케팅동의)
	Title     string    `gorm:"column:Title;size:100" json:"title"`                    // 문서 제목
	Content   string    `gorm:"column:Content;type:nvarchar(max)" json:"content"`      // 문서 내용
	Version   string    `gorm:"column:Version;size:10" json:"version"`                 // 정책 버전 (예: v1.0, 20240101)
	IsCurrent bool      `gorm:"index;column:IsCurrent;default:false" json:"isCurrent"` // 현재 적용 중인 정책인지 여부
	IsActive  bool      `gorm:"index;column:IsActive;default:true" json:"isActive"`    // 노출 여부
	CreatedAt time.Time `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`      // 등록일
	UpdatedAt time.Time `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`      // 수정일
}

// TableName은 GORM에서 사용할 테이블 이름을 반환합니다.
func (Policy) TableName() string { return "Policies" }
