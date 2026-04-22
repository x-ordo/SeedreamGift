import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button, Input, Card, Modal, FormField, Result, ListRow, StatusBadge } from '../design-system';

export default function DesignSystemPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const isDev = import.meta.env.DEV;

    if (!isDev) {
        return (
            <div className="container py-5">
                <Result 
                    icon="warning" 
                    title="접근 제한" 
                    description="디자인 시스템 페이지는 개발 환경에서만 접근 가능합니다." 
                />
            </div>
        );
    }

    const toggleLoading = () => setIsLoading(!isLoading);

    return (
        <div className="container py-5" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h1>Design System Showcase</h1>
            <p className="mb-5 text-secondary">Modular Monolith UI Assets</p>

            {/* Atoms Section */}
            <section className="mb-5">
                <h2>Atoms</h2>

                {/* Status Badges */}
                <Card className="mb-4">
                    <h4 className="mb-3">Status Badges</h4>
                    <div className="d-flex gap-2 flex-wrap">
                        <StatusBadge status="PENDING" type="order" />
                        <StatusBadge status="PAID" type="order" />
                        <StatusBadge status="DELIVERED" type="order" />
                        <StatusBadge status="CANCELLED" type="order" />
                        <StatusBadge status="VERIFIED" type="kyc" />
                    </div>
                </Card>

                {/* List Rows */}
                <Card className="mb-4">
                    <h4 className="mb-3">List Rows</h4>
                    <div className="d-flex flex-column">
                        <ListRow
                            title="기본 리스트 아이템"
                            description="설명 텍스트가 들어가는 자리입니다."
                            rightAsset={<ChevronRight size={16} aria-hidden="true" />}
                            onClick={() => {}}
                        />
                        <ListRow
                            title="상태 포함 아이템"
                            description="우측에 배지가 포함된 경우입니다."
                            rightAsset={<StatusBadge status="PAID" type="order" />}
                            withBorder
                        />
                        <ListRow
                            title="강조 텍스트"
                            rightAsset={<span className="text-primary font-weight-bold">100,000원</span>}
                        />
                    </div>
                </Card>

                {/* Buttons */}
                <Card className="mb-4">
                    <h4 className="mb-3">Buttons</h4>
                    <div className="d-flex gap-2 flex-wrap mb-3">
                        <Button variant="primary">Primary</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="outline">Outline</Button>
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="danger">Danger</Button>
                    </div>
                    <div className="d-flex gap-2 flex-wrap align-items-center">
                        <Button size="sm">Small</Button>
                        <Button size="md">Medium</Button>
                        <Button size="lg">Large</Button>
                        <Button isLoading={isLoading} onClick={toggleLoading}>
                            {isLoading ? 'Loading...' : 'Click to Load'}
                        </Button>
                        <Button disabled>Disabled</Button>
                    </div>
                </Card>

                {/* Inputs */}
                <Card className="mb-4">
                    <h4 className="mb-3">Inputs</h4>
                    <div className="d-flex flex-column gap-3">
                        <Input label="Default Input" placeholder="Type something..." />
                        <Input label="With Helper Text" placeholder="Enter email" helperText="We'll never share your email." />
                        <Input label="Error State" placeholder="Invalid input" error="This field is required." />
                        <Input label="Disabled" disabled value="Cannot edit me" />
                    </div>
                </Card>

                {/* Cards */}
                <Card className="mb-4">
                    <h4 className="mb-3">Card Variants</h4>
                    <div className="d-flex gap-3">
                        <Card>Default Card</Card>
                        <Card interactive onClick={() => alert('Clicked!')}>Interactive Card (Click Me)</Card>
                        <Card compact>Compact Card</Card>
                    </div>
                </Card>
            </section>

            {/* Molecules Section */}
            <section className="mb-5">
                <h2>Molecules</h2>

                {/* FormField */}
                <Card className="mb-4">
                    <h4 className="mb-3">FormField (Wrapper)</h4>
                    <FormField label="Full Name" placeholder="John Doe" />
                </Card>

                {/* Modal */}
                <Card>
                    <h4 className="mb-3">Modal</h4>
                    <Button onClick={() => setIsModalOpen(true)}>Open Modal</Button>

                    <Modal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        title="Example Modal"
                        footer={
                            <>
                                <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                                <Button onClick={() => setIsModalOpen(false)}>Confirm</Button>
                            </>
                        }
                    >
                        <p>This is a reusable modal component controlled by the Design System.</p>
                        <Input label="Inside Modal" placeholder="Focus me" />
                    </Modal>
                </Card>
            </section>
        </div>
    );
}
