# VouchersApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**voucherControllerBulkCreate**](#vouchercontrollerbulkcreate) | **POST** /vouchers/bulk | PIN 번호 대량 등록 (관리자용)|
|[**voucherControllerFindAll**](#vouchercontrollerfindall) | **GET** /vouchers | 전체 PIN 내역 조회 (필터 가능)|
|[**voucherControllerGetStockCount**](#vouchercontrollergetstockcount) | **GET** /vouchers/stock/{productId} | 특정 상품의 가용 재고 수량 확인 (관리자)|

# **voucherControllerBulkCreate**
> voucherControllerBulkCreate(bulkCreateVoucherDto)


### Example

```typescript
import {
    VouchersApi,
    Configuration,
    BulkCreateVoucherDto
} from './api';

const configuration = new Configuration();
const apiInstance = new VouchersApi(configuration);

let bulkCreateVoucherDto: BulkCreateVoucherDto; //

const { status, data } = await apiInstance.voucherControllerBulkCreate(
    bulkCreateVoucherDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bulkCreateVoucherDto** | **BulkCreateVoucherDto**|  | |


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

# **voucherControllerFindAll**
> voucherControllerFindAll()


### Example

```typescript
import {
    VouchersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VouchersApi(configuration);

let status: string; // (default to undefined)

const { status, data } = await apiInstance.voucherControllerFindAll(
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **status** | [**string**] |  | defaults to undefined|


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

# **voucherControllerGetStockCount**
> voucherControllerGetStockCount()


### Example

```typescript
import {
    VouchersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VouchersApi(configuration);

let productId: number; // (default to undefined)

const { status, data } = await apiInstance.voucherControllerGetStockCount(
    productId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **productId** | [**number**] |  | defaults to undefined|


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

