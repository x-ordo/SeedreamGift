# AdminVouchersApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**adminVouchersBulkPost**](#adminvouchersbulkpost) | **POST** /admin/vouchers/bulk | 바우처 일괄 업로드|
|[**adminVouchersGet**](#adminvouchersget) | **GET** /admin/vouchers | 바우처 목록 조회|
|[**adminVouchersIdDelete**](#adminvouchersiddelete) | **DELETE** /admin/vouchers/{id} | 바우처 삭제|
|[**adminVouchersIdGet**](#adminvouchersidget) | **GET** /admin/vouchers/{id} | 바우처 상세 조회|
|[**adminVouchersIdPatch**](#adminvouchersidpatch) | **PATCH** /admin/vouchers/{id} | 바우처 수정|
|[**adminVouchersInventoryGet**](#adminvouchersinventoryget) | **GET** /admin/vouchers/inventory | 바우처 재고 현황 조회|
|[**adminVouchersStockProductIdGet**](#adminvouchersstockproductidget) | **GET** /admin/vouchers/stock/{productId} | 상품별 바우처 재고 수량 조회|

# **adminVouchersBulkPost**
> InternalApiHandlersAPIResponse adminVouchersBulkPost(body)


### Example

```typescript
import {
    AdminVouchersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminVouchersApi(configuration);

let body: Array<WGiftServerInternalDomainVoucherCode>; //바우처 목록

const { status, data } = await apiInstance.adminVouchersBulkPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **Array<WGiftServerInternalDomainVoucherCode>**| 바우처 목록 | |


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminVouchersGet**
> InternalApiHandlersAPIResponse adminVouchersGet()


### Example

```typescript
import {
    AdminVouchersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminVouchersApi(configuration);

let page: number; //페이지 번호 (optional) (default to 1)
let limit: number; //페이지 크기 (optional) (default to 20)
let status: string; //상태 필터 (optional) (default to undefined)
let productId: number; //상품 ID 필터 (optional) (default to undefined)

const { status, data } = await apiInstance.adminVouchersGet(
    page,
    limit,
    status,
    productId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 | (optional) defaults to 1|
| **limit** | [**number**] | 페이지 크기 | (optional) defaults to 20|
| **status** | [**string**] | 상태 필터 | (optional) defaults to undefined|
| **productId** | [**number**] | 상품 ID 필터 | (optional) defaults to undefined|


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminVouchersIdDelete**
> InternalApiHandlersAPIResponse adminVouchersIdDelete()


### Example

```typescript
import {
    AdminVouchersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminVouchersApi(configuration);

let id: number; //바우처 ID (default to undefined)

const { status, data } = await apiInstance.adminVouchersIdDelete(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 바우처 ID | defaults to undefined|


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminVouchersIdGet**
> InternalApiHandlersAPIResponse adminVouchersIdGet()


### Example

```typescript
import {
    AdminVouchersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminVouchersApi(configuration);

let id: number; //바우처 ID (default to undefined)

const { status, data } = await apiInstance.adminVouchersIdGet(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 바우처 ID | defaults to undefined|


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |
|**404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminVouchersIdPatch**
> InternalApiHandlersAPIResponse adminVouchersIdPatch(body)


### Example

```typescript
import {
    AdminVouchersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminVouchersApi(configuration);

let id: number; //바우처 ID (default to undefined)
let body: object; //수정할 필드

const { status, data } = await apiInstance.adminVouchersIdPatch(
    id,
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**| 수정할 필드 | |
| **id** | [**number**] | 바우처 ID | defaults to undefined|


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminVouchersInventoryGet**
> InternalApiHandlersAPIResponse adminVouchersInventoryGet()


### Example

```typescript
import {
    AdminVouchersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminVouchersApi(configuration);

const { status, data } = await apiInstance.adminVouchersInventoryGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminVouchersStockProductIdGet**
> InternalApiHandlersAPIResponse adminVouchersStockProductIdGet()


### Example

```typescript
import {
    AdminVouchersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminVouchersApi(configuration);

let productId: number; //상품 ID (default to undefined)

const { status, data } = await apiInstance.adminVouchersStockProductIdGet(
    productId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **productId** | [**number**] | 상품 ID | defaults to undefined|


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

