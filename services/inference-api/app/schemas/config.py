from enum import Enum
from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class MappingVerificationStatus(str, Enum):
    UNVERIFIED = "unverified"
    VERIFIED = "verified"
    DEPRECATED = "deprecated"


class PreprocessingConfig(BaseModel):
    input_width: int = Field(..., ge=32, le=1024)
    input_height: int = Field(..., ge=32, le=1024)
    channel_order: Literal["RGB", "BGR"] = "RGB"
    tensor_layout: Literal["NCHW", "NHWC"] = "NCHW"
    resize_mode: Literal["center_crop", "letterbox", "direct_resize"] = "center_crop"
    rescale_factor: float = Field(default=1.0 / 255.0, gt=0.0)
    normalization_mean: List[float] = Field(..., min_length=3, max_length=3)
    normalization_std: List[float] = Field(..., min_length=3, max_length=3)


class CalibrationConfig(BaseModel):
    method: Literal["none", "temperature_scaling", "platt_scaling"] = "none"
    temperature: Optional[float] = Field(default=None, gt=0.0)
    platt_coef: Optional[float] = None
    platt_intercept: Optional[float] = None


class ConfidenceConfig(BaseModel):
    model_version: Optional[str] = None
    jurisdiction_code: Optional[str] = None
    accept_threshold: Optional[float] = Field(default=None, gt=0.0, le=1.0)
    review_floor_threshold: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    minimum_margin_over_second: float = Field(default=0.0, ge=0.0, le=1.0)
    require_calibrated_confidence: bool = True
    calibration: CalibrationConfig = Field(default_factory=CalibrationConfig)


class CategoryBinMapping(BaseModel):
    jurisdiction_code: str
    class_name: str
    target_bin_code: str
    target_bin_label: str
    handling_notes: str = ""
    verification_status: MappingVerificationStatus


class BinMappingsListResponse(BaseModel):
    items: List[CategoryBinMapping]
    total: int
