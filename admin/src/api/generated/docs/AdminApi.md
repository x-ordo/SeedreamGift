# AdminApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**adminControllerBulkCreateVouchers**](#admincontrollerbulkcreatevouchers) | **POST** /admin/vouchers/bulk | 바우처 대량 등록|
|[**adminControllerClearUserCart**](#admincontrollerclearusercart) | **DELETE** /admin/carts/user/{userId}/all | 사용자 장바구니 전체 비우기|
|[**adminControllerCreateBrand**](#admincontrollercreatebrand) | **POST** /admin/brands | 브랜드 생성|
|[**adminControllerCreateEvent**](#admincontrollercreateevent) | **POST** /admin/events | 이벤트 생성|
|[**adminControllerCreateFaq**](#admincontrollercreatefaq) | **POST** /admin/faqs | FAQ 생성|
|[**adminControllerCreateNotice**](#admincontrollercreatenotice) | **POST** /admin/notices | 공지사항 생성|
|[**adminControllerCreateProduct**](#admincontrollercreateproduct) | **POST** /admin/products | 상품 생성|
|[**adminControllerDeleteBrand**](#admincontrollerdeletebrand) | **DELETE** /admin/brands/{code} | 브랜드 삭제|
|[**adminControllerDeleteCartItem**](#admincontrollerdeletecartitem) | **DELETE** /admin/carts/{id} | 장바구니 아이템 삭제|
|[**adminControllerDeleteEvent**](#admincontrollerdeleteevent) | **DELETE** /admin/events/{id} | 이벤트 삭제|
|[**adminControllerDeleteFaq**](#admincontrollerdeletefaq) | **DELETE** /admin/faqs/{id} | FAQ 삭제|
|[**adminControllerDeleteNotice**](#admincontrollerdeletenotice) | **DELETE** /admin/notices/{id} | 공지사항 삭제|
|[**adminControllerDeleteProduct**](#admincontrollerdeleteproduct) | **DELETE** /admin/products/{id} | 상품 삭제|
|[**adminControllerDeleteSession**](#admincontrollerdeletesession) | **DELETE** /admin/sessions/{id} | 세션 강제 종료|
|[**adminControllerDeleteUser**](#admincontrollerdeleteuser) | **DELETE** /admin/users/{id} | 사용자 삭제|
|[**adminControllerDeleteUserSessions**](#admincontrollerdeleteusersessions) | **DELETE** /admin/sessions/user/{userId} | 사용자 전체 세션 종료|
|[**adminControllerDeleteVoucher**](#admincontrollerdeletevoucher) | **DELETE** /admin/vouchers/{id} | 바우처 삭제|
|[**adminControllerFindAllAuditLogs**](#admincontrollerfindallauditlogs) | **GET** /admin/audit-logs | 감사 로그 목록 조회|
|[**adminControllerFindAllBrands**](#admincontrollerfindallbrands) | **GET** /admin/brands | 브랜드 목록 조회|
|[**adminControllerFindAllCarts**](#admincontrollerfindallcarts) | **GET** /admin/carts | 전체 장바구니 목록 조회|
|[**adminControllerFindAllEvents**](#admincontrollerfindallevents) | **GET** /admin/events | 이벤트 목록 조회|
|[**adminControllerFindAllFaqs**](#admincontrollerfindallfaqs) | **GET** /admin/faqs | FAQ 목록 조회|
|[**adminControllerFindAllGifts**](#admincontrollerfindallgifts) | **GET** /admin/gifts | 선물 목록 조회|
|[**adminControllerFindAllNotices**](#admincontrollerfindallnotices) | **GET** /admin/notices | 공지사항 목록 조회|
|[**adminControllerFindAllOrders**](#admincontrollerfindallorders) | **GET** /admin/orders | 주문 목록 조회|
|[**adminControllerFindAllProducts**](#admincontrollerfindallproducts) | **GET** /admin/products | 상품 목록 조회|
|[**adminControllerFindAllSessions**](#admincontrollerfindallsessions) | **GET** /admin/sessions | 활성 세션 목록 조회|
|[**adminControllerFindAllSiteConfigs**](#admincontrollerfindallsiteconfigs) | **GET** /admin/site-configs | 시스템 설정 목록 조회|
|[**adminControllerFindAllTradeIns**](#admincontrollerfindalltradeins) | **GET** /admin/trade-ins | 매입 신청 목록 조회|
|[**adminControllerFindAllUsers**](#admincontrollerfindallusers) | **GET** /admin/users | 사용자 목록 조회|
|[**adminControllerFindAllVouchers**](#admincontrollerfindallvouchers) | **GET** /admin/vouchers | 바우처(PIN) 목록 조회|
|[**adminControllerFindOneAuditLog**](#admincontrollerfindoneauditlog) | **GET** /admin/audit-logs/{id} | 감사 로그 상세 조회|
|[**adminControllerFindOneBrand**](#admincontrollerfindonebrand) | **GET** /admin/brands/{code} | 브랜드 상세 조회|
|[**adminControllerFindOneEvent**](#admincontrollerfindoneevent) | **GET** /admin/events/{id} | 이벤트 상세 조회|
|[**adminControllerFindOneFaq**](#admincontrollerfindonefaq) | **GET** /admin/faqs/{id} | FAQ 상세 조회|
|[**adminControllerFindOneGift**](#admincontrollerfindonegift) | **GET** /admin/gifts/{id} | 선물 상세 조회|
|[**adminControllerFindOneNotice**](#admincontrollerfindonenotice) | **GET** /admin/notices/{id} | 공지사항 상세 조회|
|[**adminControllerFindOneOrder**](#admincontrollerfindoneorder) | **GET** /admin/orders/{id} | 주문 상세 조회|
|[**adminControllerFindOneTradeIn**](#admincontrollerfindonetradein) | **GET** /admin/trade-ins/{id} | 매입 신청 상세 조회 (복호화)|
|[**adminControllerFindOneUser**](#admincontrollerfindoneuser) | **GET** /admin/users/{id} | 사용자 상세 조회|
|[**adminControllerFindOneVoucher**](#admincontrollerfindonevoucher) | **GET** /admin/vouchers/{id} | 바우처 상세 조회 (PIN 복호화)|
|[**adminControllerFindUserCarts**](#admincontrollerfindusercarts) | **GET** /admin/carts/user/{userId} | 사용자별 장바구니 조회|
|[**adminControllerGetGiftStats**](#admincontrollergetgiftstats) | **GET** /admin/gifts/stats | 선물 통계 조회|
|[**adminControllerGetStats**](#admincontrollergetstats) | **GET** /admin/stats | 관리자 대시보드 통계 조회|
|[**adminControllerGetVoucherInventory**](#admincontrollergetvoucherinventory) | **GET** /admin/vouchers/inventory | 상품별 재고 현황 조회|
|[**adminControllerUpdateBrand**](#admincontrollerupdatebrand) | **PATCH** /admin/brands/{code} | 브랜드 수정|
|[**adminControllerUpdateEvent**](#admincontrollerupdateevent) | **PATCH** /admin/events/{id} | 이벤트 수정|
|[**adminControllerUpdateFaq**](#admincontrollerupdatefaq) | **PATCH** /admin/faqs/{id} | FAQ 수정|
|[**adminControllerUpdateKycStatus**](#admincontrollerupdatekycstatus) | **PATCH** /admin/users/{id}/kyc | 사용자 KYC 상태 변경|
|[**adminControllerUpdateNotice**](#admincontrollerupdatenotice) | **PATCH** /admin/notices/{id} | 공지사항 수정|
|[**adminControllerUpdateOrderStatus**](#admincontrollerupdateorderstatus) | **PATCH** /admin/orders/{id}/status | 주문 상태 변경|
|[**adminControllerUpdateProduct**](#admincontrollerupdateproduct) | **PATCH** /admin/products/{id} | 상품 수정|
|[**adminControllerUpdateSiteConfig**](#admincontrollerupdatesiteconfig) | **PATCH** /admin/site-configs/{id} | 시스템 설정 변경|
|[**adminControllerUpdateTradeInStatus**](#admincontrollerupdatetradeinstatus) | **PATCH** /admin/trade-ins/{id}/status | 매입 신청 상태 변경|
|[**adminControllerUpdateTradeInStatusAlt**](#admincontrollerupdatetradeinstatusalt) | **PATCH** /admin/trade-ins/{id} | 매입 신청 상태 변경 (대체 경로)|
|[**adminControllerUpdateUser**](#admincontrollerupdateuser) | **PATCH** /admin/users/{id} | 사용자 정보 수정|
|[**adminControllerUpdateUserRole**](#admincontrollerupdateuserrole) | **PATCH** /admin/users/{id}/role | 사용자 역할 변경|
|[**adminControllerUpdateVoucher**](#admincontrollerupdatevoucher) | **PATCH** /admin/vouchers/{id} | 바우처 상태 변경|

# **adminControllerBulkCreateVouchers**
> adminControllerBulkCreateVouchers(adminBulkCreateVoucherDto)


### Example

```typescript
import {
    AdminApi,
    Configuration,
    AdminBulkCreateVoucherDto
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let adminBulkCreateVoucherDto: AdminBulkCreateVoucherDto; //

const { status, data } = await apiInstance.adminControllerBulkCreateVouchers(
    adminBulkCreateVoucherDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **adminBulkCreateVoucherDto** | **AdminBulkCreateVoucherDto**|  | |


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerClearUserCart**
> adminControllerClearUserCart()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let userId: number; // (default to undefined)

const { status, data } = await apiInstance.adminControllerClearUserCart(
    userId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userId** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerCreateBrand**
> adminControllerCreateBrand(adminCreateBrandDto)


### Example

```typescript
import {
    AdminApi,
    Configuration,
    AdminCreateBrandDto
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let adminCreateBrandDto: AdminCreateBrandDto; //

const { status, data } = await apiInstance.adminControllerCreateBrand(
    adminCreateBrandDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **adminCreateBrandDto** | **AdminCreateBrandDto**|  | |


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerCreateEvent**
> adminControllerCreateEvent(adminCreateEventDto)


### Example

```typescript
import {
    AdminApi,
    Configuration,
    AdminCreateEventDto
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let adminCreateEventDto: AdminCreateEventDto; //

const { status, data } = await apiInstance.adminControllerCreateEvent(
    adminCreateEventDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **adminCreateEventDto** | **AdminCreateEventDto**|  | |


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerCreateFaq**
> adminControllerCreateFaq(adminCreateFaqDto)


### Example

```typescript
import {
    AdminApi,
    Configuration,
    AdminCreateFaqDto
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let adminCreateFaqDto: AdminCreateFaqDto; //

const { status, data } = await apiInstance.adminControllerCreateFaq(
    adminCreateFaqDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **adminCreateFaqDto** | **AdminCreateFaqDto**|  | |


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerCreateNotice**
> adminControllerCreateNotice()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

const { status, data } = await apiInstance.adminControllerCreateNotice();
```

### Parameters
This endpoint does not have any parameters.


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerCreateProduct**
> adminControllerCreateProduct(adminCreateProductDto)


### Example

```typescript
import {
    AdminApi,
    Configuration,
    AdminCreateProductDto
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let adminCreateProductDto: AdminCreateProductDto; //

const { status, data } = await apiInstance.adminControllerCreateProduct(
    adminCreateProductDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **adminCreateProductDto** | **AdminCreateProductDto**|  | |


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerDeleteBrand**
> adminControllerDeleteBrand()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let code: string; // (default to undefined)

const { status, data } = await apiInstance.adminControllerDeleteBrand(
    code
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerDeleteCartItem**
> adminControllerDeleteCartItem()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.adminControllerDeleteCartItem(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerDeleteEvent**
> adminControllerDeleteEvent()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.adminControllerDeleteEvent(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerDeleteFaq**
> adminControllerDeleteFaq()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.adminControllerDeleteFaq(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerDeleteNotice**
> adminControllerDeleteNotice()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.adminControllerDeleteNotice(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerDeleteProduct**
> adminControllerDeleteProduct()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.adminControllerDeleteProduct(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerDeleteSession**
> adminControllerDeleteSession()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.adminControllerDeleteSession(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerDeleteUser**
> adminControllerDeleteUser()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.adminControllerDeleteUser(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerDeleteUserSessions**
> adminControllerDeleteUserSessions()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let userId: number; // (default to undefined)

const { status, data } = await apiInstance.adminControllerDeleteUserSessions(
    userId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userId** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerDeleteVoucher**
> adminControllerDeleteVoucher()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.adminControllerDeleteVoucher(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindAllAuditLogs**
> adminControllerFindAllAuditLogs()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let page: number; //페이지 번호 (기본값: 1) (optional) (default to 1)
let limit: number; //페이지 당 항목 수 (기본값: 10) (optional) (default to 10)
let action: string; // (optional) (default to undefined)
let resource: string; // (optional) (default to undefined)
let userId: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.adminControllerFindAllAuditLogs(
    page,
    limit,
    action,
    resource,
    userId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 (기본값: 1) | (optional) defaults to 1|
| **limit** | [**number**] | 페이지 당 항목 수 (기본값: 10) | (optional) defaults to 10|
| **action** | [**string**] |  | (optional) defaults to undefined|
| **resource** | [**string**] |  | (optional) defaults to undefined|
| **userId** | [**number**] |  | (optional) defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindAllBrands**
> adminControllerFindAllBrands()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let page: number; //페이지 번호 (기본값: 1) (optional) (default to 1)
let limit: number; //페이지 당 항목 수 (기본값: 10) (optional) (default to 10)

const { status, data } = await apiInstance.adminControllerFindAllBrands(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 (기본값: 1) | (optional) defaults to 1|
| **limit** | [**number**] | 페이지 당 항목 수 (기본값: 10) | (optional) defaults to 10|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindAllCarts**
> adminControllerFindAllCarts()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let page: number; //페이지 번호 (기본값: 1) (optional) (default to 1)
let limit: number; //페이지 당 항목 수 (기본값: 10) (optional) (default to 10)

const { status, data } = await apiInstance.adminControllerFindAllCarts(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 (기본값: 1) | (optional) defaults to 1|
| **limit** | [**number**] | 페이지 당 항목 수 (기본값: 10) | (optional) defaults to 10|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindAllEvents**
> adminControllerFindAllEvents()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let page: number; //페이지 번호 (기본값: 1) (optional) (default to 1)
let limit: number; //페이지 당 항목 수 (기본값: 10) (optional) (default to 10)

const { status, data } = await apiInstance.adminControllerFindAllEvents(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 (기본값: 1) | (optional) defaults to 1|
| **limit** | [**number**] | 페이지 당 항목 수 (기본값: 10) | (optional) defaults to 10|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindAllFaqs**
> adminControllerFindAllFaqs()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let page: number; //페이지 번호 (기본값: 1) (optional) (default to 1)
let limit: number; //페이지 당 항목 수 (기본값: 10) (optional) (default to 10)
let category: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.adminControllerFindAllFaqs(
    page,
    limit,
    category
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 (기본값: 1) | (optional) defaults to 1|
| **limit** | [**number**] | 페이지 당 항목 수 (기본값: 10) | (optional) defaults to 10|
| **category** | [**string**] |  | (optional) defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindAllGifts**
> adminControllerFindAllGifts()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let page: number; //페이지 번호 (기본값: 1) (optional) (default to 1)
let limit: number; //페이지 당 항목 수 (기본값: 10) (optional) (default to 10)

const { status, data } = await apiInstance.adminControllerFindAllGifts(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 (기본값: 1) | (optional) defaults to 1|
| **limit** | [**number**] | 페이지 당 항목 수 (기본값: 10) | (optional) defaults to 10|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindAllNotices**
> adminControllerFindAllNotices()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let page: number; //페이지 번호 (기본값: 1) (optional) (default to 1)
let limit: number; //페이지 당 항목 수 (기본값: 10) (optional) (default to 10)

const { status, data } = await apiInstance.adminControllerFindAllNotices(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 (기본값: 1) | (optional) defaults to 1|
| **limit** | [**number**] | 페이지 당 항목 수 (기본값: 10) | (optional) defaults to 10|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindAllOrders**
> adminControllerFindAllOrders()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let page: number; //페이지 번호 (기본값: 1) (optional) (default to 1)
let limit: number; //페이지 당 항목 수 (기본값: 10) (optional) (default to 10)
let status: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.adminControllerFindAllOrders(
    page,
    limit,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 (기본값: 1) | (optional) defaults to 1|
| **limit** | [**number**] | 페이지 당 항목 수 (기본값: 10) | (optional) defaults to 10|
| **status** | [**string**] |  | (optional) defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindAllProducts**
> adminControllerFindAllProducts()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let page: number; //페이지 번호 (기본값: 1) (optional) (default to 1)
let limit: number; //페이지 당 항목 수 (기본값: 10) (optional) (default to 10)

const { status, data } = await apiInstance.adminControllerFindAllProducts(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 (기본값: 1) | (optional) defaults to 1|
| **limit** | [**number**] | 페이지 당 항목 수 (기본값: 10) | (optional) defaults to 10|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindAllSessions**
> adminControllerFindAllSessions()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let page: number; //페이지 번호 (기본값: 1) (optional) (default to 1)
let limit: number; //페이지 당 항목 수 (기본값: 10) (optional) (default to 10)

const { status, data } = await apiInstance.adminControllerFindAllSessions(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 (기본값: 1) | (optional) defaults to 1|
| **limit** | [**number**] | 페이지 당 항목 수 (기본값: 10) | (optional) defaults to 10|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindAllSiteConfigs**
> adminControllerFindAllSiteConfigs()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

const { status, data } = await apiInstance.adminControllerFindAllSiteConfigs();
```

### Parameters
This endpoint does not have any parameters.


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindAllTradeIns**
> adminControllerFindAllTradeIns()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let page: number; //페이지 번호 (기본값: 1) (optional) (default to 1)
let limit: number; //페이지 당 항목 수 (기본값: 10) (optional) (default to 10)
let status: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.adminControllerFindAllTradeIns(
    page,
    limit,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 (기본값: 1) | (optional) defaults to 1|
| **limit** | [**number**] | 페이지 당 항목 수 (기본값: 10) | (optional) defaults to 10|
| **status** | [**string**] |  | (optional) defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindAllUsers**
> adminControllerFindAllUsers()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let page: number; //페이지 번호 (기본값: 1) (optional) (default to 1)
let limit: number; //페이지 당 항목 수 (기본값: 10) (optional) (default to 10)

const { status, data } = await apiInstance.adminControllerFindAllUsers(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 (기본값: 1) | (optional) defaults to 1|
| **limit** | [**number**] | 페이지 당 항목 수 (기본값: 10) | (optional) defaults to 10|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindAllVouchers**
> adminControllerFindAllVouchers()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let page: number; //페이지 번호 (기본값: 1) (optional) (default to 1)
let limit: number; //페이지 당 항목 수 (기본값: 10) (optional) (default to 10)
let productId: number; // (optional) (default to undefined)
let status: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.adminControllerFindAllVouchers(
    page,
    limit,
    productId,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 (기본값: 1) | (optional) defaults to 1|
| **limit** | [**number**] | 페이지 당 항목 수 (기본값: 10) | (optional) defaults to 10|
| **productId** | [**number**] |  | (optional) defaults to undefined|
| **status** | [**string**] |  | (optional) defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindOneAuditLog**
> adminControllerFindOneAuditLog()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.adminControllerFindOneAuditLog(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindOneBrand**
> adminControllerFindOneBrand()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let code: string; // (default to undefined)

const { status, data } = await apiInstance.adminControllerFindOneBrand(
    code
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindOneEvent**
> adminControllerFindOneEvent()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.adminControllerFindOneEvent(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindOneFaq**
> adminControllerFindOneFaq()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.adminControllerFindOneFaq(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindOneGift**
> adminControllerFindOneGift()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.adminControllerFindOneGift(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindOneNotice**
> adminControllerFindOneNotice()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.adminControllerFindOneNotice(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindOneOrder**
> adminControllerFindOneOrder()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.adminControllerFindOneOrder(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindOneTradeIn**
> adminControllerFindOneTradeIn()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.adminControllerFindOneTradeIn(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindOneUser**
> adminControllerFindOneUser()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.adminControllerFindOneUser(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindOneVoucher**
> adminControllerFindOneVoucher()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.adminControllerFindOneVoucher(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerFindUserCarts**
> adminControllerFindUserCarts()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let userId: number; // (default to undefined)

const { status, data } = await apiInstance.adminControllerFindUserCarts(
    userId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userId** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerGetGiftStats**
> adminControllerGetGiftStats()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

const { status, data } = await apiInstance.adminControllerGetGiftStats();
```

### Parameters
This endpoint does not have any parameters.


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerGetStats**
> adminControllerGetStats()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

const { status, data } = await apiInstance.adminControllerGetStats();
```

### Parameters
This endpoint does not have any parameters.


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerGetVoucherInventory**
> adminControllerGetVoucherInventory()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

const { status, data } = await apiInstance.adminControllerGetVoucherInventory();
```

### Parameters
This endpoint does not have any parameters.


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerUpdateBrand**
> adminControllerUpdateBrand(adminUpdateBrandDto)


### Example

```typescript
import {
    AdminApi,
    Configuration,
    AdminUpdateBrandDto
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let code: string; // (default to undefined)
let adminUpdateBrandDto: AdminUpdateBrandDto; //

const { status, data } = await apiInstance.adminControllerUpdateBrand(
    code,
    adminUpdateBrandDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **adminUpdateBrandDto** | **AdminUpdateBrandDto**|  | |
| **code** | [**string**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerUpdateEvent**
> adminControllerUpdateEvent(adminUpdateEventDto)


### Example

```typescript
import {
    AdminApi,
    Configuration,
    AdminUpdateEventDto
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)
let adminUpdateEventDto: AdminUpdateEventDto; //

const { status, data } = await apiInstance.adminControllerUpdateEvent(
    id,
    adminUpdateEventDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **adminUpdateEventDto** | **AdminUpdateEventDto**|  | |
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerUpdateFaq**
> adminControllerUpdateFaq(adminUpdateFaqDto)


### Example

```typescript
import {
    AdminApi,
    Configuration,
    AdminUpdateFaqDto
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)
let adminUpdateFaqDto: AdminUpdateFaqDto; //

const { status, data } = await apiInstance.adminControllerUpdateFaq(
    id,
    adminUpdateFaqDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **adminUpdateFaqDto** | **AdminUpdateFaqDto**|  | |
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerUpdateKycStatus**
> adminControllerUpdateKycStatus(updateKycStatusDto)


### Example

```typescript
import {
    AdminApi,
    Configuration,
    UpdateKycStatusDto
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)
let updateKycStatusDto: UpdateKycStatusDto; //

const { status, data } = await apiInstance.adminControllerUpdateKycStatus(
    id,
    updateKycStatusDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **updateKycStatusDto** | **UpdateKycStatusDto**|  | |
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerUpdateNotice**
> adminControllerUpdateNotice()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.adminControllerUpdateNotice(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerUpdateOrderStatus**
> adminControllerUpdateOrderStatus(updateOrderStatusDto)


### Example

```typescript
import {
    AdminApi,
    Configuration,
    UpdateOrderStatusDto
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)
let updateOrderStatusDto: UpdateOrderStatusDto; //

const { status, data } = await apiInstance.adminControllerUpdateOrderStatus(
    id,
    updateOrderStatusDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **updateOrderStatusDto** | **UpdateOrderStatusDto**|  | |
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerUpdateProduct**
> adminControllerUpdateProduct(adminUpdateProductDto)


### Example

```typescript
import {
    AdminApi,
    Configuration,
    AdminUpdateProductDto
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)
let adminUpdateProductDto: AdminUpdateProductDto; //

const { status, data } = await apiInstance.adminControllerUpdateProduct(
    id,
    adminUpdateProductDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **adminUpdateProductDto** | **AdminUpdateProductDto**|  | |
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerUpdateSiteConfig**
> adminControllerUpdateSiteConfig()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.adminControllerUpdateSiteConfig(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerUpdateTradeInStatus**
> adminControllerUpdateTradeInStatus(updateTradeInStatusDto)


### Example

```typescript
import {
    AdminApi,
    Configuration,
    UpdateTradeInStatusDto
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)
let updateTradeInStatusDto: UpdateTradeInStatusDto; //

const { status, data } = await apiInstance.adminControllerUpdateTradeInStatus(
    id,
    updateTradeInStatusDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **updateTradeInStatusDto** | **UpdateTradeInStatusDto**|  | |
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerUpdateTradeInStatusAlt**
> adminControllerUpdateTradeInStatusAlt(updateTradeInStatusDto)


### Example

```typescript
import {
    AdminApi,
    Configuration,
    UpdateTradeInStatusDto
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)
let updateTradeInStatusDto: UpdateTradeInStatusDto; //

const { status, data } = await apiInstance.adminControllerUpdateTradeInStatusAlt(
    id,
    updateTradeInStatusDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **updateTradeInStatusDto** | **UpdateTradeInStatusDto**|  | |
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerUpdateUser**
> adminControllerUpdateUser(adminUpdateUserDto)


### Example

```typescript
import {
    AdminApi,
    Configuration,
    AdminUpdateUserDto
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)
let adminUpdateUserDto: AdminUpdateUserDto; //

const { status, data } = await apiInstance.adminControllerUpdateUser(
    id,
    adminUpdateUserDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **adminUpdateUserDto** | **AdminUpdateUserDto**|  | |
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerUpdateUserRole**
> adminControllerUpdateUserRole(updateUserRoleDto)


### Example

```typescript
import {
    AdminApi,
    Configuration,
    UpdateUserRoleDto
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)
let updateUserRoleDto: UpdateUserRoleDto; //

const { status, data } = await apiInstance.adminControllerUpdateUserRole(
    id,
    updateUserRoleDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **updateUserRoleDto** | **UpdateUserRoleDto**|  | |
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminControllerUpdateVoucher**
> adminControllerUpdateVoucher(adminUpdateVoucherDto)


### Example

```typescript
import {
    AdminApi,
    Configuration,
    AdminUpdateVoucherDto
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

let id: number; // (default to undefined)
let adminUpdateVoucherDto: AdminUpdateVoucherDto; //

const { status, data } = await apiInstance.adminControllerUpdateVoucher(
    id,
    adminUpdateVoucherDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **adminUpdateVoucherDto** | **AdminUpdateVoucherDto**|  | |
| **id** | [**number**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

