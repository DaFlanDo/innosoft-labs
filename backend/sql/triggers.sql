-- =============================================
-- InnoSoft Labs — Триггеры и хранимые процедуры (MySQL 8)
-- =============================================

DELIMITER $$

-- ─── 1. Автообновление updated_at ────────────

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
BEGIN
    SET NEW.updated_at = NOW();
END$$

CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
BEGIN
    SET NEW.updated_at = NOW();
END$$


-- ─── 2. Автоматический пересчёт прогресса проекта ────

CREATE TRIGGER trg_task_insert_progress
    AFTER INSERT ON tasks
    FOR EACH ROW
BEGIN
    DECLARE v_total INT;
    DECLARE v_done INT;
    DECLARE v_progress INT;

    SELECT COUNT(*), SUM(IF(status = 'done', 1, 0))
      INTO v_total, v_done
      FROM tasks WHERE project_id = NEW.project_id;

    IF v_total > 0 THEN
        SET v_progress = ROUND((v_done / v_total) * 100);
    ELSE
        SET v_progress = 0;
    END IF;

    UPDATE projects SET progress = v_progress WHERE id = NEW.project_id;
END$$

CREATE TRIGGER trg_task_update_progress
    AFTER UPDATE ON tasks
    FOR EACH ROW
BEGIN
    DECLARE v_total INT;
    DECLARE v_done INT;
    DECLARE v_progress INT;

    SELECT COUNT(*), SUM(IF(status = 'done', 1, 0))
      INTO v_total, v_done
      FROM tasks WHERE project_id = NEW.project_id;

    IF v_total > 0 THEN
        SET v_progress = ROUND((v_done / v_total) * 100);
    ELSE
        SET v_progress = 0;
    END IF;

    UPDATE projects SET progress = v_progress WHERE id = NEW.project_id;
END$$

CREATE TRIGGER trg_task_delete_progress
    AFTER DELETE ON tasks
    FOR EACH ROW
BEGIN
    DECLARE v_total INT;
    DECLARE v_done INT;
    DECLARE v_progress INT;

    SELECT COUNT(*), SUM(IF(status = 'done', 1, 0))
      INTO v_total, v_done
      FROM tasks WHERE project_id = OLD.project_id;

    IF v_total > 0 THEN
        SET v_progress = ROUND((v_done / v_total) * 100);
    ELSE
        SET v_progress = 0;
    END IF;

    UPDATE projects SET progress = v_progress WHERE id = OLD.project_id;
END$$


-- ─── 3. Уведомление при назначении задачи ────

CREATE TRIGGER trg_task_assigned_insert
    AFTER INSERT ON tasks
    FOR EACH ROW
BEGIN
    IF NEW.assignee_id IS NOT NULL THEN
        INSERT INTO notifications (id, user_id, type, message, is_read, created_at)
        VALUES (UUID(), NEW.assignee_id, 'task_assigned',
                CONCAT('Вам назначена задача: ', NEW.title), FALSE, NOW());
    END IF;
END$$

CREATE TRIGGER trg_task_assigned_update
    AFTER UPDATE ON tasks
    FOR EACH ROW
BEGIN
    IF NEW.assignee_id IS NOT NULL
       AND (OLD.assignee_id IS NULL OR NEW.assignee_id != OLD.assignee_id) THEN
        INSERT INTO notifications (id, user_id, type, message, is_read, created_at)
        VALUES (UUID(), NEW.assignee_id, 'task_assigned',
                CONCAT('Вам назначена задача: ', NEW.title), FALSE, NOW());
    END IF;
END$$


-- ─── 4. Запрет удаления проекта с активными задачами ────

CREATE TRIGGER trg_prevent_project_delete
    BEFORE DELETE ON projects
    FOR EACH ROW
BEGIN
    DECLARE v_active INT;

    SELECT COUNT(*) INTO v_active
      FROM tasks
     WHERE project_id = OLD.id AND status != 'done';

    IF v_active > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Нельзя удалить проект с незавершёнными задачами';
    END IF;
END$$


-- =============================================
-- Хранимые процедуры
-- =============================================

-- ─── 1. Перенос задач между исполнителями ────

CREATE PROCEDURE sp_reassign_tasks(
    IN p_from_user_id CHAR(36),
    IN p_to_user_id   CHAR(36)
)
BEGIN
    UPDATE tasks
       SET assignee_id = p_to_user_id, updated_at = NOW()
     WHERE assignee_id = p_from_user_id AND status != 'done';

    INSERT INTO notifications (id, user_id, type, message, is_read, created_at)
    VALUES (UUID(), p_to_user_id, 'tasks_reassigned',
            'Вам переданы задачи от другого сотрудника', FALSE, NOW());
END$$


-- ─── 2. Архивирование завершённого проекта ────

CREATE PROCEDURE sp_archive_project(IN p_project_id CHAR(36))
BEGIN
    UPDATE tasks
       SET status = 'done', updated_at = NOW()
     WHERE project_id = p_project_id AND status != 'done';

    UPDATE projects
       SET status = 'archived', progress = 100, updated_at = NOW()
     WHERE id = p_project_id;
END$$


-- ─── 3. Статистика участника ────

CREATE PROCEDURE sp_user_stats(IN p_user_id CHAR(36))
BEGIN
    SELECT
        COUNT(*)                              AS total_tasks,
        SUM(IF(status = 'todo', 1, 0))       AS todo,
        SUM(IF(status = 'progress', 1, 0))   AS in_progress,
        SUM(IF(status = 'done', 1, 0))       AS done,
        (SELECT COUNT(DISTINCT project_id)
           FROM tasks WHERE assignee_id = p_user_id) AS projects_count
    FROM tasks
    WHERE assignee_id = p_user_id;
END$$


-- ─── 4. Очистка старых уведомлений ────

CREATE PROCEDURE sp_cleanup_notifications(IN p_days_old INT)
BEGIN
    DELETE FROM notifications
     WHERE is_read = TRUE
       AND created_at < DATE_SUB(NOW(), INTERVAL p_days_old DAY);
END$$

DELIMITER ;
