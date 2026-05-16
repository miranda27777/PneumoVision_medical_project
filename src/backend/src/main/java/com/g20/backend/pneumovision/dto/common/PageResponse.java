package com.g20.backend.pneumovision.dto.common;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.domain.Page;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PageResponse<T> {

    private List<T> items;
    private long total;
    private int page;
    private int size;
    private int totalPages;

    public static <T> PageResponse<T> from(Page<T> page) {
        return PageResponse.<T>builder()
                .items(page.getContent())
                .total(page.getTotalElements())
                .page(page.getNumber())
                .size(page.getSize())
                .totalPages(page.getTotalPages())
                .build();
    }
}

