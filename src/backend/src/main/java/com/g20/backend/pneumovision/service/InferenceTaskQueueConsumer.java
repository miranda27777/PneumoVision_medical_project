package com.g20.backend.pneumovision.service;

import com.g20.backend.pneumovision.dto.inference.InferenceTaskMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class InferenceTaskQueueConsumer {

    private final InferenceTaskService inferenceTaskService;
    private final RabbitTemplate rabbitTemplate;
    @Value("${inference.queue.exchange}")
    private String exchange;
    @Value("${inference.queue.routing-key}")
    private String routingKey;
    @Value("${inference.queue.dead-letter-exchange}")
    private String deadLetterExchange;
    @Value("${inference.queue.dead-letter-routing-key}")
    private String deadLetterRoutingKey;
    @Value("${inference.queue.max-retries}")
    private int maxRetries;

    @RabbitListener(queues = "${inference.queue.name}")
    public void consume(InferenceTaskMessage message) {
        if (message == null || message.getTaskId() == null) {
            return;
        }
        int currentRetry = message.getRetryCount() == null ? 0 : message.getRetryCount();
        try {
            inferenceTaskService.processQueuedTask(message);
        } catch (Exception ex) {
            if (currentRetry < maxRetries) {
                inferenceTaskService.markTaskQueuedForRetry(message.getTaskId(), currentRetry + 1, ex.getMessage());
                message.setRetryCount(currentRetry + 1);
                rabbitTemplate.convertAndSend(exchange, routingKey, message);
                return;
            }
            inferenceTaskService.markTaskFailed(message.getTaskId(), ex.getMessage());
            rabbitTemplate.convertAndSend(deadLetterExchange, deadLetterRoutingKey, message);
        }
    }
}
