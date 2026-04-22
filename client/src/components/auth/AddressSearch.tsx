/**
 * @file AddressSearch.tsx
 * @description 다음(카카오) 우편번호 API 연동 주소 검색 컴포넌트
 * @module components/auth
 */
import React, { useCallback } from 'react';
import { Button, TextField } from '../../design-system';
import { MapPin } from 'lucide-react';

interface AddressData {
  zipCode: string;
  address: string;
}

interface AddressSearchProps {
  zipCode: string;
  address: string;
  addressDetail: string;
  onAddressChange: (data: Partial<AddressData & { addressDetail: string }>) => void;
}

declare global {
  interface Window {
    daum: {
      Postcode: new (options: {
        oncomplete: (data: {
          zonecode: string;
          roadAddress: string;
          jibunAddress: string;
          userSelectedType: string;
        }) => void;
      }) => { open: () => void };
    };
  }
}

function loadDaumPostcodeScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.daum?.Postcode) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('주소 검색 스크립트 로드에 실패했습니다.'));
    document.head.appendChild(script);
  });
}

const AddressSearch: React.FC<AddressSearchProps> = ({
  zipCode,
  address,
  addressDetail,
  onAddressChange,
}) => {
  const handleSearch = useCallback(async () => {
    try {
      await loadDaumPostcodeScript();
      new window.daum.Postcode({
        oncomplete: (data) => {
          const selectedAddress =
            data.userSelectedType === 'R' ? data.roadAddress : data.jibunAddress;
          onAddressChange({
            zipCode: data.zonecode,
            address: selectedAddress,
          });
        },
      }).open();
    } catch {
      alert('주소 검색을 사용할 수 없습니다. 잠시 후 다시 시도해주세요.');
    }
  }, [onAddressChange]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div className="flex-1 min-w-0">
          <TextField
            variant="box"
            label="우편번호"
            labelOption="sustain"
            value={zipCode}
            readOnly
            placeholder="00000"
            className="tabular-nums"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={handleSearch}
          className="h-[56px] px-6 rounded-2xl border-grey-200 font-bold shrink-0"
          leftIcon={<MapPin size={18} aria-hidden="true" />}
        >
          주소 검색
        </Button>
      </div>

      <TextField
        variant="box"
        label="기본 주소"
        labelOption="sustain"
        value={address}
        readOnly
        placeholder="주소 검색을 완료해주세요"
        onClick={handleSearch}
      />

      <TextField
        variant="box"
        label="상세 주소"
        labelOption="sustain"
        value={addressDetail}
        onChange={(e) => onAddressChange({ addressDetail: e.target.value })}
        placeholder="상세 정보를 입력하세요 (예: 101동 101호)"
        required
        autoComplete="street-address"
      />
    </div>
  );
};

export default AddressSearch;
